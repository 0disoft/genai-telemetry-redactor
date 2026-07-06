import { createBuiltInDetectors } from "./built-in-detectors.js";
import type {
  BuiltInDetectorName,
  Detection,
  Detector,
  RedactionOptions,
  RedactionReason,
  RedactionReport,
  RedactionResult,
  RedactionWarning,
  ReplacementTokenPolicy,
  SafeRedactionError,
} from "./types.js";

const DEFAULT_MAX_STRING_LENGTH = 128_000;

export const defaultReplacementToken: ReplacementTokenPolicy = (reason) =>
  `[REDACTED:${reason}]`;

export async function redactText(
  input: string,
  options: RedactionOptions = {},
): Promise<RedactionResult<string>> {
  const warnings: RedactionWarning[] = [];
  const maxStringLength =
    options.limits?.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH;

  if (input.length > maxStringLength) {
    warnings.push({ code: "max_string_length_exceeded" });
    return failure(
      "max_string_length_exceeded",
      "Input exceeded the configured redaction limit.",
      warnings,
    );
  }

  const detectors = resolveDetectors(options);
  const detections: Detection[] = [];

  for (const detector of detectors) {
    let detectorDetections: Detection[];

    try {
      detectorDetections = await Promise.resolve(
        detector.detect(input, {
          detectorId: detector.id,
          inputLength: input.length,
        }),
      );
    } catch {
      warnings.push({ code: "detector_failed", detectorId: detector.id });
      return failure(
        "detector_failed",
        "A detector failed before content could be safely redacted.",
        warnings,
        {
          detectorId: detector.id,
        },
      );
    }

    for (const detection of detectorDetections) {
      if (!isValidDetection(input, detection)) {
        warnings.push({
          code: "invalid_detection_range",
          detectorId: detector.id,
          reason: detection.reason,
        });
        return failure(
          "invalid_detection_range",
          "A detector returned an invalid range.",
          warnings,
          {
            detectorId: detector.id,
          },
        );
      }

      detections.push(detection);
    }
  }

  const selectedDetections = selectNonOverlappingDetections(
    detections,
    warnings,
  );
  const replacement = options.replacement ?? defaultReplacementToken;
  const value = applyRedactions(input, selectedDetections, replacement);
  const report = createReport(selectedDetections, warnings);

  return {
    ok: true,
    value,
    report,
    warnings,
  };
}

function resolveDetectors(options: RedactionOptions): Detector[] {
  const builtInNames: readonly BuiltInDetectorName[] =
    options.builtInDetectors === false
      ? []
      : (options.builtInDetectors ?? [
          "email",
          "bearer_token",
          "api_key",
          "url",
        ]);

  return [
    ...createBuiltInDetectors(builtInNames),
    ...(options.detectors ?? []),
  ];
}

function isValidDetection(input: string, detection: Detection): boolean {
  return (
    Number.isInteger(detection.start) &&
    Number.isInteger(detection.end) &&
    detection.start >= 0 &&
    detection.end <= input.length &&
    detection.start < detection.end
  );
}

function selectNonOverlappingDetections(
  detections: readonly Detection[],
  warnings: RedactionWarning[],
): Detection[] {
  const sorted = [...detections].sort((left, right) => {
    if (left.start !== right.start) {
      return left.start - right.start;
    }

    return right.end - left.end;
  });

  const selected: Detection[] = [];
  let lastEnd = -1;

  for (const detection of sorted) {
    if (detection.start < lastEnd) {
      warnings.push({
        code: "overlapping_detection",
        reason: detection.reason,
      });
      continue;
    }

    selected.push(detection);
    lastEnd = detection.end;
  }

  return selected;
}

function applyRedactions(
  input: string,
  detections: readonly Detection[],
  replacement: ReplacementTokenPolicy,
): string {
  let output = "";
  let cursor = 0;

  for (const detection of detections) {
    output += input.slice(cursor, detection.start);
    output += replacement(detection.reason);
    cursor = detection.end;
  }

  output += input.slice(cursor);
  return output;
}

function createReport(
  detections: readonly Detection[],
  warnings: RedactionWarning[],
): RedactionReport {
  const countsByReason: Record<string, number> = {};

  for (const detection of detections) {
    countsByReason[detection.reason] =
      (countsByReason[detection.reason] ?? 0) + 1;
  }

  return {
    status: detections.length > 0 ? "redacted" : "unchanged",
    totalRedactions: detections.length,
    countsByReason,
    warnings,
  };
}

function failure(
  code: SafeRedactionError["code"],
  message: string,
  warnings: RedactionWarning[],
  fields: Pick<SafeRedactionError, "detectorId"> = {},
): RedactionResult<string> {
  return {
    ok: false,
    report: {
      status: "failed",
      totalRedactions: 0,
      countsByReason: {},
      warnings,
    },
    warnings,
    error: {
      code,
      message,
      ...fields,
    },
  };
}
