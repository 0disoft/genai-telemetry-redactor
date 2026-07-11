import {
  isSafeReason,
  resolveDetectors,
  safeReplacementReason,
  safeWarningReasonFields,
} from "./detector-policy.js";
import {
  resolveRedactionOperationOptions,
  type RedactionOperationOptions,
} from "./redaction-profile.js";
import { createFailure, createRedactionReport } from "./report.js";
import type {
  Detection,
  Detector,
  RedactionOptions,
  RedactionResult,
  RedactionWarning,
  ReplacementTokenPolicy,
} from "./types.js";

const DEFAULT_MAX_STRING_LENGTH = 128_000;

export const defaultReplacementToken: ReplacementTokenPolicy = (reason) =>
  `[REDACTED:${safeReplacementReason(reason)}]`;

export async function redactText(
  input: string,
  operationOptions: RedactionOperationOptions = {},
): Promise<RedactionResult<string>> {
  const result = await redactTextInternal(input, operationOptions);
  result.report.timings = {
    ...result.report.timings,
    nodesVisited: 1,
    stringCodeUnits: typeof input === "string" ? input.length : 0,
  };
  return result;
}

async function redactTextInternal(
  input: string,
  operationOptions: RedactionOperationOptions,
): Promise<RedactionResult<string>> {
  const startedAtMs = Date.now();
  const warnings: RedactionWarning[] = [];
  const optionsResult = resolveRedactionOperationOptions(operationOptions);
  if (!optionsResult.ok) {
    warnings.push({ code: optionsResult.error.code });
    return createFailure(
      optionsResult.error.code,
      optionsResult.error.message,
      warnings,
    );
  }

  const options = optionsResult.value;
  const totalDeadlineEpochMs = totalDeadlineEpochMsFromOptions(
    startedAtMs,
    options,
  );
  let detectorRuns = 0;
  let detectorDurationMs = 0;
  if (typeof input !== "string") {
    warnings.push({ code: "invalid_redaction_input" });
    return createFailure(
      "invalid_redaction_input",
      "Redaction input must be a string.",
      warnings,
      {},
      timingMetrics(startedAtMs, detectorDurationMs, detectorRuns),
    );
  }

  if (isTotalDurationExceeded(totalDeadlineEpochMs)) {
    return totalDurationFailure(
      warnings,
      startedAtMs,
      detectorDurationMs,
      detectorRuns,
    );
  }

  const maxStringLength =
    options.limits?.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH;

  if (options.signal?.aborted) {
    warnings.push({ code: "redaction_aborted" });
    return createFailure(
      "redaction_aborted",
      "Redaction was aborted before content could be safely redacted.",
      warnings,
      {},
      timingMetrics(startedAtMs, detectorDurationMs, detectorRuns),
    );
  }

  if (input.length > maxStringLength) {
    warnings.push({ code: "max_string_length_exceeded" });
    return createFailure(
      "max_string_length_exceeded",
      "Input exceeded the configured redaction limit.",
      warnings,
      {},
      timingMetrics(startedAtMs, detectorDurationMs, detectorRuns),
    );
  }

  if (isTotalDurationExceeded(totalDeadlineEpochMs)) {
    return totalDurationFailure(
      warnings,
      startedAtMs,
      detectorDurationMs,
      detectorRuns,
    );
  }

  const detectorResult = resolveDetectors(options);
  if (!detectorResult.ok) {
    warnings.push({
      code: detectorResult.error.code,
      ...(detectorResult.error.detectorId === undefined
        ? {}
        : { detectorId: detectorResult.error.detectorId }),
    });
    return createFailure(
      detectorResult.error.code,
      detectorResult.error.message,
      warnings,
      detectorResult.error.detectorId === undefined
        ? {}
        : { detectorId: detectorResult.error.detectorId },
    );
  }

  const detectors = detectorResult.value;
  const maxDetectors = options.limits?.maxDetectors;
  if (
    maxDetectors !== undefined &&
    detectors.length > Math.max(0, maxDetectors)
  ) {
    warnings.push({ code: "max_detectors_exceeded" });
    return createFailure(
      "max_detectors_exceeded",
      "Detector count exceeded the configured redaction limit.",
      warnings,
      {},
      timingMetrics(startedAtMs, detectorDurationMs, detectorRuns),
    );
  }

  const detections: Detection[] = [];

  for (const detector of detectors) {
    if (isTotalDurationExceeded(totalDeadlineEpochMs)) {
      return totalDurationFailure(
        warnings,
        startedAtMs,
        detectorDurationMs,
        detectorRuns,
      );
    }

    let detectorDetections: Detection[];
    const detectorControl = createDetectorControl(
      options,
      totalDeadlineEpochMs,
    );
    const detectorStartedAtMs = Date.now();
    let detectorDurationRecorded = false;
    detectorRuns += 1;

    try {
      detectorDetections = await runDetector(detector, input, detectorControl);
    } catch (error) {
      detectorDurationMs += Date.now() - detectorStartedAtMs;
      detectorDurationRecorded = true;
      const failureCode =
        error instanceof DetectorRunError ? error.code : "detector_failed";
      warnings.push({ code: failureCode, detectorId: detector.id });
      return createFailure(
        failureCode,
        detectorFailureMessage(failureCode),
        warnings,
        {
          detectorId: detector.id,
        },
        timingMetrics(startedAtMs, detectorDurationMs, detectorRuns),
      );
    } finally {
      if (!detectorDurationRecorded) {
        detectorDurationMs += Date.now() - detectorStartedAtMs;
      }
      detectorControl.dispose();
    }

    if (isTotalDurationExceeded(totalDeadlineEpochMs)) {
      return totalDurationFailure(
        warnings,
        startedAtMs,
        detectorDurationMs,
        detectorRuns,
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
          timingMetrics(startedAtMs, detectorDurationMs, detectorRuns),
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
          timingMetrics(startedAtMs, detectorDurationMs, detectorRuns),
        );
      }

      detections.push(detection);
    }
  }

  const selectedDetectionsResult = selectNonOverlappingDetections(
    detections,
    warnings,
    timingMetrics(startedAtMs, detectorDurationMs, detectorRuns),
  );
  if (!selectedDetectionsResult.ok) {
    return selectedDetectionsResult;
  }

  const selectedDetections = selectedDetectionsResult.value;
  const maxTotalDetections = options.limits?.maxTotalDetections;
  if (
    maxTotalDetections !== undefined &&
    selectedDetections.length > Math.max(0, maxTotalDetections)
  ) {
    warnings.push({ code: "max_total_detections_exceeded" });
    return createFailure(
      "max_total_detections_exceeded",
      "Detection count exceeded the configured redaction limit.",
      warnings,
      {},
      timingMetrics(startedAtMs, detectorDurationMs, detectorRuns),
    );
  }

  const replacement = options.replacement ?? defaultReplacementToken;
  const redaction = applyRedactions(
    input,
    selectedDetections,
    replacement,
    warnings,
    timingMetrics(startedAtMs, detectorDurationMs, detectorRuns),
  );
  if (!redaction.ok) {
    return redaction;
  }

  const report = createRedactionReport(
    selectedDetections.map((detection) => detection.reason),
    warnings,
    timingMetrics(startedAtMs, detectorDurationMs, detectorRuns),
  );

  return {
    ok: true,
    value: redaction.value,
    report,
    warnings,
  };
}

type DetectorControl = {
  signal: AbortSignal;
  deadlineEpochMs?: number;
  timeoutMs?: number;
  dispose(): void;
  failureCode():
    "detector_timeout" | "max_total_duration_exceeded" | "redaction_aborted";
};

class DetectorRunError extends Error {
  constructor(
    readonly code:
      "detector_timeout" | "max_total_duration_exceeded" | "redaction_aborted",
  ) {
    super(code);
  }
}

function createDetectorControl(
  options: RedactionOptions,
  totalDeadlineEpochMs: number | undefined,
): DetectorControl {
  const timeoutMs = options.limits?.maxDetectorDurationMs;
  const parentSignal = options.signal;
  const controller = new AbortController();
  let detectorTimedOut = false;
  let totalTimedOut = false;

  const abortFromParent = () => {
    controller.abort();
  };
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener("abort", abortFromParent, { once: true });
    }
  }

  const normalizedTimeoutMs =
    timeoutMs === undefined ? undefined : Math.max(0, timeoutMs);
  const detectorTimer =
    normalizedTimeoutMs === undefined
      ? undefined
      : setTimeout(() => {
          detectorTimedOut = true;
          controller.abort();
        }, normalizedTimeoutMs);
  const totalRemainingMs =
    totalDeadlineEpochMs === undefined
      ? undefined
      : Math.max(0, totalDeadlineEpochMs - Date.now());
  const totalTimer =
    totalRemainingMs === undefined
      ? undefined
      : totalRemainingMs === 0
        ? (() => {
            totalTimedOut = true;
            controller.abort();
            return undefined;
          })()
        : setTimeout(() => {
            totalTimedOut = true;
            controller.abort();
          }, totalRemainingMs);

  const control: DetectorControl = {
    signal: controller.signal,
    dispose() {
      if (detectorTimer) {
        clearTimeout(detectorTimer);
      }

      if (totalTimer) {
        clearTimeout(totalTimer);
      }

      parentSignal?.removeEventListener("abort", abortFromParent);
    },
    failureCode() {
      if (
        totalTimedOut ||
        (totalDeadlineEpochMs !== undefined &&
          Date.now() >= totalDeadlineEpochMs &&
          !detectorTimedOut)
      ) {
        return "max_total_duration_exceeded";
      }

      return detectorTimedOut ? "detector_timeout" : "redaction_aborted";
    },
  };

  const detectorDeadlineEpochMs =
    normalizedTimeoutMs === undefined
      ? undefined
      : Date.now() + normalizedTimeoutMs;
  const effectiveDeadlineEpochMs = earliestDeadlineEpochMs(
    detectorDeadlineEpochMs,
    totalDeadlineEpochMs,
  );

  if (normalizedTimeoutMs !== undefined) {
    control.timeoutMs = normalizedTimeoutMs;
  }

  if (effectiveDeadlineEpochMs !== undefined) {
    control.deadlineEpochMs = effectiveDeadlineEpochMs;
  }

  return control;
}

async function runDetector(
  detector: Detector,
  input: string,
  control: DetectorControl,
): Promise<Detection[]> {
  if (control.signal.aborted) {
    throw new DetectorRunError(control.failureCode());
  }

  const detectPromise = Promise.resolve(
    detector.detect(input, {
      detectorId: detector.id,
      inputLength: input.length,
      signal: control.signal,
      ...(control.deadlineEpochMs === undefined
        ? {}
        : { deadlineEpochMs: control.deadlineEpochMs }),
    }),
  );

  let removeAbortListener = () => undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    const abort = () => {
      reject(new DetectorRunError(control.failureCode()));
    };
    control.signal.addEventListener("abort", abort, { once: true });
    removeAbortListener = () => {
      control.signal.removeEventListener("abort", abort);
    };
  });

  try {
    return await Promise.race([detectPromise, abortPromise]);
  } finally {
    removeAbortListener();
  }
}

function detectorFailureMessage(
  code:
    | "detector_failed"
    | "detector_timeout"
    | "max_total_duration_exceeded"
    | "redaction_aborted",
): string {
  switch (code) {
    case "detector_timeout":
      return "A detector timed out before content could be safely redacted.";
    case "max_total_duration_exceeded":
      return "Redaction exceeded the configured total operation duration.";
    case "redaction_aborted":
      return "Redaction was aborted before content could be safely redacted.";
    case "detector_failed":
      return "A detector failed before content could be safely redacted.";
  }
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
  timings: ReturnType<typeof timingMetrics>,
): RedactionResult<Detection[]> {
  const sorted = [...detections].sort((left, right) => {
    if (left.start !== right.start) {
      return left.start - right.start;
    }

    return right.end - left.end;
  });

  const selected: Detection[] = [];
  let lastEnd = -1;
  let lastStart = -1;

  for (const detection of sorted) {
    if (detection.start < lastEnd) {
      warnings.push({
        code: "overlapping_detection",
        ...safeWarningReasonFields(detection.reason),
      });

      if (detection.start === lastStart) {
        continue;
      }

      return createFailure(
        "overlapping_detection",
        "Overlapping detector ranges could not be safely resolved.",
        warnings,
        {},
        timings,
      );
    }

    selected.push(detection);
    lastStart = detection.start;
    lastEnd = detection.end;
  }

  return {
    ok: true,
    value: selected,
    report: createRedactionReport(
      selected.map((detection) => detection.reason),
      warnings,
    ),
    warnings,
  };
}

function applyRedactions(
  input: string,
  detections: readonly Detection[],
  replacement: ReplacementTokenPolicy,
  warnings: RedactionWarning[],
  timings: ReturnType<typeof timingMetrics>,
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
        {},
        timings,
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
      timings,
    ),
    warnings,
  };
}

function timingMetrics(
  startedAtMs: number,
  detectorDurationMs: number,
  detectorRuns: number,
) {
  return {
    durationMs: Date.now() - startedAtMs,
    detectorDurationMs,
    detectorRuns,
  };
}

function totalDeadlineEpochMsFromOptions(
  startedAtMs: number,
  options: RedactionOptions,
): number | undefined {
  const maxTotalDurationMs = options.limits?.maxTotalDurationMs;
  return maxTotalDurationMs === undefined
    ? undefined
    : startedAtMs + Math.max(0, maxTotalDurationMs);
}

function earliestDeadlineEpochMs(
  left: number | undefined,
  right: number | undefined,
): number | undefined {
  if (left === undefined) {
    return right;
  }

  if (right === undefined) {
    return left;
  }

  return Math.min(left, right);
}

function isTotalDurationExceeded(deadlineEpochMs: number | undefined): boolean {
  return deadlineEpochMs !== undefined && Date.now() >= deadlineEpochMs;
}

function totalDurationFailure<T>(
  warnings: RedactionWarning[],
  startedAtMs: number,
  detectorDurationMs: number,
  detectorRuns: number,
): RedactionResult<T> {
  warnings.push({ code: "max_total_duration_exceeded" });
  return createFailure(
    "max_total_duration_exceeded",
    "Redaction exceeded the configured total operation duration.",
    warnings,
    {},
    timingMetrics(startedAtMs, detectorDurationMs, detectorRuns),
  );
}
