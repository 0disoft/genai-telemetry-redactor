import {
  createRedactionReportAccumulator,
  type RedactionReportAccumulator,
} from "./report.js";
import { redactText } from "./redact-text.js";
import type {
  RedactionOptions,
  RedactionResult,
  RedactionWarning,
  SafeRedactionError,
} from "./types.js";

const DEFAULT_MAX_OBJECT_DEPTH = 16;
const DEFAULT_MAX_OBJECT_KEYS = 1_000;
const DEFAULT_MAX_ARRAY_LENGTH = 1_000;
const DEFAULT_MAX_TOTAL_NODES = 10_000;
const DEFAULT_MAX_TOTAL_STRING_LENGTH = 1_000_000;
const DEFAULT_MAX_TOTAL_DETECTIONS = 10_000;
const DEFAULT_MAX_DETECTOR_RUNS = 50_000;

type JsonLikeRecord = Record<string, unknown>;

type TraversalState = {
  options: RedactionOptions;
  warnings: RedactionWarning[];
  reportAccumulator: RedactionReportAccumulator;
  seen: WeakSet<object>;
  limits: Required<
    Pick<
      NonNullable<RedactionOptions["limits"]>,
      | "maxObjectDepth"
      | "maxObjectKeys"
      | "maxArrayLength"
      | "maxTotalNodes"
      | "maxTotalStringLength"
      | "maxTotalDetections"
      | "maxDetectorRuns"
    >
  >;
  totalNodes: number;
  totalStringLength: number;
  totalDetections: number;
  detectorRuns: number;
};

export async function redactJsonLike<T>(
  input: T,
  options: RedactionOptions = {},
): Promise<RedactionResult<T>> {
  const warnings: RedactionWarning[] = [];
  const state: TraversalState = {
    options,
    warnings,
    reportAccumulator: createRedactionReportAccumulator(),
    seen: new WeakSet<object>(),
    limits: {
      maxObjectDepth:
        options.limits?.maxObjectDepth ?? DEFAULT_MAX_OBJECT_DEPTH,
      maxObjectKeys: options.limits?.maxObjectKeys ?? DEFAULT_MAX_OBJECT_KEYS,
      maxArrayLength:
        options.limits?.maxArrayLength ?? DEFAULT_MAX_ARRAY_LENGTH,
      maxTotalNodes: options.limits?.maxTotalNodes ?? DEFAULT_MAX_TOTAL_NODES,
      maxTotalStringLength:
        options.limits?.maxTotalStringLength ?? DEFAULT_MAX_TOTAL_STRING_LENGTH,
      maxTotalDetections:
        options.limits?.maxTotalDetections ?? DEFAULT_MAX_TOTAL_DETECTIONS,
      maxDetectorRuns:
        options.limits?.maxDetectorRuns ?? DEFAULT_MAX_DETECTOR_RUNS,
    },
    totalNodes: 0,
    totalStringLength: 0,
    totalDetections: 0,
    detectorRuns: 0,
  };

  const value = await visit(input, "$", 0, state);
  if (!value.ok) {
    return value;
  }

  const report = state.reportAccumulator.snapshot();
  return {
    ok: true,
    value: value.value as T,
    report,
    warnings: report.warnings,
  };
}

export function redactToolArguments(
  input: unknown,
  options: RedactionOptions = {},
): Promise<RedactionResult<unknown>> {
  return redactJsonLike(input, options);
}

async function visit(
  value: unknown,
  path: string,
  depth: number,
  state: TraversalState,
): Promise<RedactionResult<unknown>> {
  state.totalNodes += 1;
  if (state.totalNodes > state.limits.maxTotalNodes) {
    state.warnings.push({ code: "max_total_nodes_exceeded", path });
    return createTraversalFailure(
      state,
      "max_total_nodes_exceeded",
      "Node count exceeded the configured redaction limit.",
    );
  }

  if (typeof value === "string") {
    state.totalStringLength += value.length;
    if (state.totalStringLength > state.limits.maxTotalStringLength) {
      state.warnings.push({
        code: "max_total_string_length_exceeded",
        path,
      });
      return createTraversalFailure(
        state,
        "max_total_string_length_exceeded",
        "Total string length exceeded the configured redaction limit.",
      );
    }

    const detectorRunCount = countDetectorRuns(state.options);
    state.detectorRuns += detectorRunCount;
    if (state.detectorRuns > state.limits.maxDetectorRuns) {
      state.warnings.push({ code: "max_detector_runs_exceeded", path });
      return createTraversalFailure(
        state,
        "max_detector_runs_exceeded",
        "Detector execution count exceeded the configured redaction limit.",
      );
    }

    const result = await redactText(value, state.options);
    if (!result.ok) {
      return result;
    }

    state.totalDetections += result.report.totalRedactions;
    if (state.totalDetections > state.limits.maxTotalDetections) {
      state.reportAccumulator.add(result.report);
      state.warnings.push({ code: "max_total_detections_exceeded", path });
      return createTraversalFailure(
        state,
        "max_total_detections_exceeded",
        "Detection count exceeded the configured redaction limit.",
      );
    }

    state.reportAccumulator.add(result.report);
    return {
      ok: true,
      value: result.value,
      report: result.report,
      warnings: result.warnings,
    };
  }

  if (value === null || typeof value !== "object") {
    return unchanged(value, state);
  }

  if (state.seen.has(value)) {
    state.warnings.push({ code: "circular_reference", path });
    return createTraversalFailure(
      state,
      "circular_reference",
      "Circular reference encountered before content could be safely redacted.",
    );
  }

  if (depth >= state.limits.maxObjectDepth) {
    state.warnings.push({ code: "max_object_depth_exceeded", path });
    return createTraversalFailure(
      state,
      "max_object_depth_exceeded",
      "Object depth exceeded the configured redaction limit.",
    );
  }

  state.seen.add(value);
  try {
    if (Array.isArray(value)) {
      return await visitArray(value, path, depth, state);
    }

    if (!isPlainObject(value)) {
      state.warnings.push({ code: "unsupported_json_like", path });
      return createTraversalFailure(
        state,
        "unsupported_json_like",
        "Only plain JSON-like objects can be safely traversed.",
      );
    }

    return await visitObject(value as JsonLikeRecord, path, depth, state);
  } finally {
    state.seen.delete(value);
  }
}

function countDetectorRuns(options: RedactionOptions): number {
  const builtInDetectorCount =
    options.builtInDetectors === false
      ? 0
      : (options.builtInDetectors?.length ?? 4);
  return builtInDetectorCount + (options.detectors?.length ?? 0);
}

async function visitArray(
  value: readonly unknown[],
  path: string,
  depth: number,
  state: TraversalState,
): Promise<RedactionResult<unknown[]>> {
  if (value.length > state.limits.maxArrayLength) {
    state.warnings.push({ code: "max_array_length_exceeded", path });
    return createTraversalFailure(
      state,
      "max_array_length_exceeded",
      "Array length exceeded the configured redaction limit.",
    );
  }

  const next: unknown[] = [];
  for (const [index, item] of value.entries()) {
    const result = await visit(item, `${path}[${index}]`, depth + 1, state);
    if (!result.ok) {
      return result;
    }

    next.push(result.value);
  }

  return unchanged(next, state);
}

async function visitObject(
  value: JsonLikeRecord,
  path: string,
  depth: number,
  state: TraversalState,
): Promise<RedactionResult<JsonLikeRecord>> {
  const entries = Object.entries(value);
  if (entries.length > state.limits.maxObjectKeys) {
    state.warnings.push({ code: "max_object_keys_exceeded", path });
    return createTraversalFailure(
      state,
      "max_object_keys_exceeded",
      "Object key count exceeded the configured redaction limit.",
    );
  }

  const next: JsonLikeRecord = {};
  for (const [index, [key, item]] of entries.entries()) {
    const safeChildPath = `${path}.{${index}}`;
    const keySafety = await redactText(key, state.options);
    if (!keySafety.ok) {
      state.warnings.push({ code: keySafety.error.code, path: safeChildPath });
      return createTraversalFailure(
        state,
        keySafety.error.code,
        keySafety.error.message,
        keySafety.error.detectorId
          ? { detectorId: keySafety.error.detectorId }
          : {},
      );
    }

    if (keySafety.report.totalRedactions > 0 || keySafety.value !== key) {
      state.warnings.push({ code: "unsafe_object_key", path: safeChildPath });
      return createTraversalFailure(
        state,
        "unsafe_object_key",
        "Object keys that look content-bearing cannot be safely preserved.",
      );
    }

    const result = await visit(item, safeChildPath, depth + 1, state);
    if (!result.ok) {
      return result;
    }

    next[key] = result.value;
  }

  return unchanged(next, state);
}

function unchanged<T>(value: T, state: TraversalState): RedactionResult<T> {
  const report = state.reportAccumulator.snapshot();
  return {
    ok: true,
    value,
    report,
    warnings: report.warnings,
  };
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function createTraversalFailure<T>(
  state: TraversalState,
  code: SafeRedactionError["code"],
  message: string,
  fields: Pick<SafeRedactionError, "detectorId"> = {},
): RedactionResult<T> {
  state.reportAccumulator.addWarnings(state.warnings);
  state.reportAccumulator.markFailed();
  const report = state.reportAccumulator.snapshot();

  return {
    ok: false,
    report,
    warnings: report.warnings,
    error: {
      code,
      message,
      ...fields,
    },
  };
}
