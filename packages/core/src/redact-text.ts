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
const BUILT_IN_REASONS = new Set<RedactionReason>([
  "email",
  "bearer_token",
  "api_key",
  "url",
]);
const SAFE_CUSTOM_REASON_PATTERN = /^custom:[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export const defaultReplacementToken: ReplacementTokenPolicy = (reason) =>
  `[REDACTED:${safeReplacementReason(reason)}]`;

export async function redactText(
  input: string,
  options: RedactionOptions = {},
): Promise<RedactionResult<string>> {
  const warnings: RedactionWarning[] = [];
  if (typeof input !== "string") {
    warnings.push({ code: "invalid_redaction_input" });
    return createFailure(
      "invalid_redaction_input",
      "Redaction input must be a string.",
      warnings,
    );
  }

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

  const detectorResult = resolveDetectors(options, warnings);
  if (!detectorResult.ok) {
    return detectorResult;
  }

  const detectors = detectorResult.value;
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
          ...safeWarningReasonFields(detection.reason),
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

      if (!isSafeReason(detection.reason)) {
        warnings.push({
          code: "invalid_redaction_reason",
          detectorId: detector.id,
        });
        return createFailure(
          "invalid_redaction_reason",
          "A detector returned an unsafe redaction reason.",
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
  const redaction = applyRedactions(
    input,
    selectedDetections,
    replacement,
    warnings,
  );
  if (!redaction.ok) {
    return redaction;
  }

  const report = createRedactionReport(
    selectedDetections.map((detection) => detection.reason),
    warnings,
  );

  return {
    ok: true,
    value: redaction.value,
    report,
    warnings,
  };
}

function resolveDetectors(
  options: RedactionOptions,
  warnings: RedactionWarning[],
): RedactionResult<Detector[]> {
  if (options === null || typeof options !== "object") {
    warnings.push({ code: "invalid_redaction_options" });
    return createFailure(
      "invalid_redaction_options",
      "Redaction options must be an object.",
      warnings,
    );
  }

  const builtInNames: readonly BuiltInDetectorName[] =
    options.builtInDetectors === false
      ? []
      : (options.builtInDetectors ?? [
          "email",
          "bearer_token",
          "api_key",
          "url",
        ]);

  for (const name of builtInNames) {
    if (!isBuiltInDetectorName(name)) {
      warnings.push({ code: "invalid_redaction_options" });
      return createFailure(
        "invalid_redaction_options",
        "Redaction options included an unknown built-in detector.",
        warnings,
      );
    }
  }

  const customDetectors = options.detectors ?? [];
  if (!Array.isArray(customDetectors)) {
    warnings.push({ code: "invalid_redaction_options" });
    return createFailure(
      "invalid_redaction_options",
      "Custom detectors must be provided as an array.",
      warnings,
    );
  }

  for (const detector of customDetectors) {
    if (!isDetector(detector)) {
      warnings.push({ code: "invalid_redaction_options" });
      return createFailure(
        "invalid_redaction_options",
        "Redaction options included an invalid detector.",
        warnings,
      );
    }

    for (const reason of detector.reasons) {
      if (!isSafeReason(reason)) {
        warnings.push({
          code: "invalid_redaction_reason",
          detectorId: detector.id,
        });
        return createFailure(
          "invalid_redaction_reason",
          "A detector declared an unsafe redaction reason.",
          warnings,
          {
            detectorId: detector.id,
          },
        );
      }
    }
  }

  return {
    ok: true,
    value: [...createBuiltInDetectors(builtInNames), ...customDetectors],
    report: createRedactionReport([], warnings),
    warnings,
  };
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
        ...safeWarningReasonFields(detection.reason),
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
  warnings: RedactionWarning[],
): RedactionResult<string> {
  let output = "";
  let cursor = 0;

  for (const detection of detections) {
    output += input.slice(cursor, detection.start);
    try {
      output += replacement(detection.reason);
    } catch {
      warnings.push({ code: "replacement_failed" });
      return createFailure(
        "replacement_failed",
        "Replacement token generation failed before content could be safely redacted.",
        warnings,
      );
    }
    cursor = detection.end;
  }

  output += input.slice(cursor);
  return {
    ok: true,
    value: output,
    report: createRedactionReport(
      detections.map((detection) => detection.reason),
      warnings,
    ),
    warnings,
  };
}

function isBuiltInDetectorName(value: unknown): value is BuiltInDetectorName {
  return (
    value === "email" ||
    value === "bearer_token" ||
    value === "api_key" ||
    value === "url"
  );
}

function isDetector(value: unknown): value is Detector {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Detector>;
  return (
    typeof candidate.id === "string" &&
    Array.isArray(candidate.reasons) &&
    typeof candidate.detect === "function"
  );
}

function isSafeReason(value: unknown): value is RedactionReason {
  return (
    typeof value === "string" &&
    (BUILT_IN_REASONS.has(value as RedactionReason) ||
      SAFE_CUSTOM_REASON_PATTERN.test(value))
  );
}

function safeReplacementReason(reason: RedactionReason): string {
  if (BUILT_IN_REASONS.has(reason)) {
    return reason;
  }

  return SAFE_CUSTOM_REASON_PATTERN.test(reason) ? reason : "custom";
}

function safeWarningReasonFields(
  reason: RedactionReason,
): Pick<RedactionWarning, "reason"> | Record<string, never> {
  return isSafeReason(reason) ? { reason } : {};
}
