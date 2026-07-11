import { resolveDetectors } from "./detector-policy.js";
import type {
  RedactionLimits,
  RedactionOptions,
  SafeRedactionError,
} from "./types.js";

const PROFILE_STATE = Symbol("genai-telemetry-redactor.profile");
const PROFILE_CONFIG_KEYS = new Set([
  "builtInDetectors",
  "detectors",
  "limits",
  "replacement",
]);
const PROFILE_EXECUTION_KEYS = new Set(["profile", "signal"]);
const REDACTION_OPTION_KEYS = new Set([
  "builtInDetectors",
  "detectors",
  "limits",
  "replacement",
  "signal",
]);
const LIMIT_KEYS = new Set<keyof RedactionLimits>([
  "maxStringLength",
  "maxTotalStringLength",
  "maxObjectDepth",
  "maxObjectKeys",
  "maxArrayLength",
  "maxTotalNodes",
  "maxTotalDetections",
  "maxDetectors",
  "maxDetectorRuns",
  "maxDetectorDurationMs",
  "maxTotalDurationMs",
  "maxStreamBufferLength",
]);

type RedactionProfileState = {
  readonly options: Readonly<RedactionOptions>;
};

export type RedactionProfileConfig = Readonly<Omit<RedactionOptions, "signal">>;

export type RedactionProfile = {
  readonly [PROFILE_STATE]: RedactionProfileState;
};

export type RedactionProfileCreationResult =
  | { ok: true; value: RedactionProfile }
  | { ok: false; error: SafeRedactionError };

export type RedactionProfileExecutionOptions = {
  profile: RedactionProfile;
  signal?: AbortSignal;
};

export type RedactionOperationOptions =
  RedactionOptions | RedactionProfileExecutionOptions;

type OperationOptionsResolution =
  | { ok: true; value: RedactionOptions }
  | { ok: false; error: SafeRedactionError };

export function createRedactionProfile(
  config: RedactionProfileConfig,
): RedactionProfileCreationResult {
  try {
    return createRedactionProfileInternal(config);
  } catch {
    return invalidProfile();
  }
}

export function resolveRedactionOperationOptions(
  input: unknown,
): OperationOptionsResolution {
  try {
    return resolveRedactionOperationOptionsInternal(input);
  } catch {
    return invalidOperationOptions();
  }
}

function createRedactionProfileInternal(
  config: RedactionProfileConfig,
): RedactionProfileCreationResult {
  if (!isPlainRecord(config) || hasUnknownKeys(config, PROFILE_CONFIG_KEYS)) {
    return invalidProfile();
  }

  if (
    config.replacement !== undefined &&
    typeof config.replacement !== "function"
  ) {
    return invalidProfile();
  }

  if (!isValidLimits(config.limits)) {
    return invalidProfile();
  }

  const detectorResult = resolveDetectors(config);
  if (!detectorResult.ok) {
    return invalidProfile();
  }

  const detectors = detectorResult.value;
  if (
    detectors.length === 0 ||
    detectors.some(
      (detector) => detector.id.length === 0 || detector.reasons.length === 0,
    ) ||
    new Set(detectors.map((detector) => detector.id)).size !== detectors.length
  ) {
    return invalidProfile();
  }

  const maxDetectors = config.limits?.maxDetectors;
  if (maxDetectors !== undefined && maxDetectors < detectors.length) {
    return invalidProfile();
  }

  const options = snapshotOptions(config);
  const state = Object.freeze({ options });
  const profile = Object.freeze({ [PROFILE_STATE]: state });
  return { ok: true, value: profile };
}

function resolveRedactionOperationOptionsInternal(
  input: unknown,
): OperationOptionsResolution {
  if (!isPlainRecord(input)) {
    return invalidOperationOptions();
  }

  if (!Object.hasOwn(input, "profile")) {
    if (
      hasUnknownKeys(input, REDACTION_OPTION_KEYS) ||
      !isValidLimits(input.limits) ||
      (input.replacement !== undefined &&
        typeof input.replacement !== "function") ||
      !isAbortSignalOrUndefined(input.signal)
    ) {
      return invalidOperationOptions();
    }

    return { ok: true, value: input as RedactionOptions };
  }

  if (
    hasUnknownKeys(input, PROFILE_EXECUTION_KEYS) ||
    !isRedactionProfile(input.profile) ||
    !isAbortSignalOrUndefined(input.signal)
  ) {
    return invalidOperationOptions();
  }

  return {
    ok: true,
    value: {
      ...input.profile[PROFILE_STATE].options,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    },
  };
}

function snapshotOptions(config: RedactionProfileConfig): RedactionOptions {
  const builtInDetectors =
    config.builtInDetectors === false
      ? false
      : config.builtInDetectors === undefined
        ? undefined
        : Object.freeze([...config.builtInDetectors]);
  const detectors =
    config.detectors === undefined
      ? undefined
      : Object.freeze([...config.detectors]);
  const limits =
    config.limits === undefined
      ? undefined
      : Object.freeze({ ...config.limits });

  return Object.freeze({
    ...(builtInDetectors === undefined ? {} : { builtInDetectors }),
    ...(detectors === undefined ? {} : { detectors }),
    ...(limits === undefined ? {} : { limits }),
    ...(config.replacement === undefined
      ? {}
      : { replacement: config.replacement }),
  });
}

function isValidLimits(value: unknown): value is RedactionLimits | undefined {
  if (value === undefined) {
    return true;
  }

  if (!isPlainRecord(value) || hasUnknownKeys(value, LIMIT_KEYS)) {
    return false;
  }

  return Object.values(value).every(
    (limit) =>
      typeof limit === "number" && Number.isFinite(limit) && limit >= 0,
  );
}

function isRedactionProfile(value: unknown): value is RedactionProfile {
  return (
    isRecord(value) &&
    Object.hasOwn(value, PROFILE_STATE) &&
    isRecord(value[PROFILE_STATE])
  );
}

function isAbortSignalOrUndefined(
  value: unknown,
): value is AbortSignal | undefined {
  if (value === undefined) {
    return true;
  }

  return (
    isRecord(value) &&
    typeof value.aborted === "boolean" &&
    typeof value.addEventListener === "function" &&
    typeof value.removeEventListener === "function"
  );
}

function hasUnknownKeys(
  value: Record<PropertyKey, unknown>,
  allowedKeys: ReadonlySet<PropertyKey>,
): boolean {
  return Reflect.ownKeys(value).some((key) => !allowedKeys.has(key));
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  if (!isRecord(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function invalidProfile(): RedactionProfileCreationResult {
  return {
    ok: false,
    error: {
      code: "invalid_redaction_profile",
      message: "Redaction profile configuration is invalid.",
    },
  };
}

function invalidOperationOptions(): OperationOptionsResolution {
  return {
    ok: false,
    error: {
      code: "invalid_redaction_options",
      message: "Redaction options must be a valid options or profile object.",
    },
  };
}
