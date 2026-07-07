import { createBuiltInDetectors } from "./built-in-detectors.js";
import { createFailure, createRedactionReport } from "./report.js";
import type {
  BuiltInDetectorName,
  Detection,
  Detector,
  RedactionOptions,
  RedactionReason,
  RedactionResult,
  RedactionWarning,
  ReplacementTokenPolicy,
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
    return createFailure(
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
      return createFailure(
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
        return createFailure(
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
  const report = createRedactionReport(
    selectedDetections.map((detection) => detection.reason),
    warnings,
  );

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
    detection.start < detection.end &&
    isUtf16Boundary(input, detection.start) &&
    isUtf16Boundary(input, detection.end)
  );
}

function isUtf16Boundary(input: string, index: number): boolean {
  if (index === 0 || index === input.length) {
    return true;
  }

  const previous = input.charCodeAt(index - 1);
  const current = input.charCodeAt(index);
  return !(isHighSurrogate(previous) && isLowSurrogate(current));
}

function isHighSurrogate(codeUnit: number): boolean {
  return codeUnit >= 0xd800 && codeUnit <= 0xdbff;
}

function isLowSurrogate(codeUnit: number): boolean {
  return codeUnit >= 0xdc00 && codeUnit <= 0xdfff;
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
