import { createFailure, mergeReports } from "./report.js";
import { redactText } from "./redact-text.js";
import type {
  RedactionOptions,
  RedactionReport,
  RedactionResult,
  RedactionWarning,
} from "./types.js";

const DEFAULT_MAX_OBJECT_DEPTH = 16;
const DEFAULT_MAX_OBJECT_KEYS = 1_000;
const DEFAULT_MAX_ARRAY_LENGTH = 1_000;

type JsonLikeRecord = Record<string, unknown>;

type TraversalState = {
  options: RedactionOptions;
  warnings: RedactionWarning[];
  reports: RedactionReport[];
  seen: WeakSet<object>;
  limits: Required<
    Pick<
      NonNullable<RedactionOptions["limits"]>,
      "maxObjectDepth" | "maxObjectKeys" | "maxArrayLength"
    >
  >;
};

export async function redactJsonLike<T>(
  input: T,
  options: RedactionOptions = {},
): Promise<RedactionResult<T>> {
  const warnings: RedactionWarning[] = [];
  const state: TraversalState = {
    options,
    warnings,
    reports: [],
    seen: new WeakSet<object>(),
    limits: {
      maxObjectDepth:
        options.limits?.maxObjectDepth ?? DEFAULT_MAX_OBJECT_DEPTH,
      maxObjectKeys: options.limits?.maxObjectKeys ?? DEFAULT_MAX_OBJECT_KEYS,
      maxArrayLength:
        options.limits?.maxArrayLength ?? DEFAULT_MAX_ARRAY_LENGTH,
    },
  };

  const value = await visit(input, "$", 0, state);
  if (!value.ok) {
    return value;
  }

  const report = mergeReports(state.reports);
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
  if (typeof value === "string") {
    const result = await redactText(value, state.options);
    if (!result.ok) {
      return result;
    }

    state.reports.push(result.report);
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
    return createFailure(
      "circular_reference",
      "Circular reference encountered before content could be safely redacted.",
      state.warnings,
    );
  }

  if (depth >= state.limits.maxObjectDepth) {
    state.warnings.push({ code: "max_object_depth_exceeded", path });
    return createFailure(
      "max_object_depth_exceeded",
      "Object depth exceeded the configured redaction limit.",
      state.warnings,
    );
  }

  state.seen.add(value);
  try {
    if (Array.isArray(value)) {
      return await visitArray(value, path, depth, state);
    }

    return await visitObject(value as JsonLikeRecord, path, depth, state);
  } finally {
    state.seen.delete(value);
  }
}

async function visitArray(
  value: readonly unknown[],
  path: string,
  depth: number,
  state: TraversalState,
): Promise<RedactionResult<unknown[]>> {
  if (value.length > state.limits.maxArrayLength) {
    state.warnings.push({ code: "max_array_length_exceeded", path });
    return createFailure(
      "max_array_length_exceeded",
      "Array length exceeded the configured redaction limit.",
      state.warnings,
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
    return createFailure(
      "max_object_keys_exceeded",
      "Object key count exceeded the configured redaction limit.",
      state.warnings,
    );
  }

  const next: JsonLikeRecord = {};
  for (const [key, item] of entries) {
    const result = await visit(item, `${path}.${key}`, depth + 1, state);
    if (!result.ok) {
      return result;
    }

    next[key] = result.value;
  }

  return unchanged(next, state);
}

function unchanged<T>(value: T, state: TraversalState): RedactionResult<T> {
  const report = mergeReports(state.reports);
  return {
    ok: true,
    value,
    report,
    warnings: report.warnings,
  };
}
