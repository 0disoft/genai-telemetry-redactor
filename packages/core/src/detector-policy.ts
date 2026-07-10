import { createBuiltInDetectors } from "./built-in-detectors.js";
import type {
  BuiltInDetectorName,
  Detector,
  RedactionOptions,
  RedactionReason,
  RedactionWarning,
  SafeRedactionError,
} from "./types.js";

const DEFAULT_BUILT_IN_DETECTORS: readonly BuiltInDetectorName[] = [
  "email",
  "bearer_token",
  "api_key",
  "url",
];
const BUILT_IN_REASONS = new Set<RedactionReason>(DEFAULT_BUILT_IN_DETECTORS);
const SAFE_CUSTOM_REASON_PATTERN = /^custom:[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export type DetectorResolution =
  | { ok: true; value: Detector[] }
  | {
      ok: false;
      error: Pick<SafeRedactionError, "code" | "message" | "detectorId">;
    };

export function resolveDetectors(
  options: RedactionOptions,
): DetectorResolution {
  const builtInSelection = options.builtInDetectors;
  if (
    builtInSelection !== undefined &&
    builtInSelection !== false &&
    !Array.isArray(builtInSelection)
  ) {
    return invalidOptions("Built-in detectors must be an array or false.");
  }

  const builtInNames: readonly BuiltInDetectorName[] =
    builtInSelection === false
      ? []
      : (builtInSelection ?? DEFAULT_BUILT_IN_DETECTORS);

  for (const name of builtInNames) {
    if (!isBuiltInDetectorName(name)) {
      return invalidOptions(
        "Redaction options included an unknown built-in detector.",
      );
    }
  }

  const customDetectors = options.detectors ?? [];
  if (!Array.isArray(customDetectors)) {
    return invalidOptions("Custom detectors must be provided as an array.");
  }

  for (const detector of customDetectors) {
    if (!isDetector(detector)) {
      return invalidOptions("Redaction options included an invalid detector.");
    }

    for (const reason of detector.reasons) {
      if (!isSafeReason(reason)) {
        return {
          ok: false,
          error: {
            code: "invalid_redaction_reason",
            message: "A detector declared an unsafe redaction reason.",
            detectorId: detector.id,
          },
        };
      }
    }
  }

  return {
    ok: true,
    value: [...createBuiltInDetectors(builtInNames), ...customDetectors],
  };
}

export function isSafeReason(value: unknown): value is RedactionReason {
  return (
    typeof value === "string" &&
    (BUILT_IN_REASONS.has(value as RedactionReason) ||
      SAFE_CUSTOM_REASON_PATTERN.test(value))
  );
}

export function safeReplacementReason(reason: RedactionReason): string {
  if (BUILT_IN_REASONS.has(reason)) {
    return reason;
  }

  return SAFE_CUSTOM_REASON_PATTERN.test(reason) ? reason : "custom";
}

export function safeWarningReasonFields(
  reason: RedactionReason,
): Pick<RedactionWarning, "reason"> | Record<string, never> {
  return isSafeReason(reason) ? { reason } : {};
}

function invalidOptions(message: string): DetectorResolution {
  return {
    ok: false,
    error: {
      code: "invalid_redaction_options",
      message,
    },
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
