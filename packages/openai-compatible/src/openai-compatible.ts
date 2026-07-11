import {
  redactJsonLike,
  redactText,
  redactToolArguments,
  type RedactionOperationOptions,
  type RedactionOptions,
  type RedactionReport,
  type RedactionResult,
  type SafeRedactionError,
  type RedactionWarning,
} from "../../core/src/index.js";
import { resolveRedactionOperationOptions } from "../../core/src/redaction-profile.js";
import {
  createRedactionReportAccumulator,
  type RedactionReportAccumulator,
} from "../../core/src/report.js";
import type {
  OpenAICompatibleOptions,
  OpenAICompatibleStreamRedactionMetadata,
} from "./types.js";

type MutableRecord = Record<string, unknown>;

type AdapterState = {
  redaction: RedactionOptions;
  totalDeadlineEpochMs: number | undefined;
  maxTotalDetections: number;
  maxDetectorRuns: number;
  maxTotalNodes: number;
  maxTotalStringLength: number;
  totalDetections: number;
  detectorRuns: number;
  totalNodes: number;
  totalStringLength: number;
  detectorCount: number;
  redactToolNames: boolean;
  reportAccumulator: RedactionReportAccumulator;
  warnings: RedactionWarning[];
};

const DEFAULT_MAX_TOTAL_DETECTIONS = 10_000;
const DEFAULT_MAX_DETECTOR_RUNS = 50_000;
const DEFAULT_MAX_TOTAL_NODES = 10_000;
const DEFAULT_MAX_TOTAL_STRING_LENGTH = 1_000_000;

const REQUEST_KEYS = new Set([
  "messages",
  "prompt",
  "input",
  "model",
  "temperature",
  "top_p",
  "n",
  "stream",
  "max_tokens",
  "max_completion_tokens",
  "response_format",
]);
const RESPONSE_KEYS = new Set([
  "id",
  "object",
  "created",
  "model",
  "choices",
  "usage",
  "system_fingerprint",
]);
const CHOICE_KEYS = new Set(["index", "text", "message", "finish_reason"]);
const MESSAGE_KEYS = new Set(["role", "content", "tool_calls"]);
const TOOL_CALL_KEYS = new Set(["id", "type", "function"]);
const FUNCTION_KEYS = new Set(["name", "arguments"]);

export async function redactOpenAICompatibleRequest<T>(
  input: T,
  options: OpenAICompatibleOptions = {},
): Promise<RedactionResult<T>> {
  const stateResult = createAdapterState(options);
  if (!stateResult.ok) {
    return stateResult.failure;
  }
  const state = stateResult.value;

  try {
    if (!isRecord(input)) {
      return unsupportedShape(state);
    }

    const keyResult = validateAllowedKeys(input, REQUEST_KEYS, state, "$");
    if (!keyResult.ok) {
      return keyResult;
    }

    const cloned = cloneRecord(input);
    const redactResult = await redactRequestRecord(cloned, state);
    if (!redactResult.ok) {
      return redactResult;
    }

    return success(cloned as T, state);
  } catch {
    return unsupportedShape(state);
  }
}

export async function redactOpenAICompatibleResponse<T>(
  input: T,
  options: OpenAICompatibleOptions = {},
): Promise<RedactionResult<T>> {
  const stateResult = createAdapterState(options);
  if (!stateResult.ok) {
    return stateResult.failure;
  }
  const state = stateResult.value;

  try {
    if (!isRecord(input)) {
      return unsupportedShape(state);
    }

    const keyResult = validateAllowedKeys(input, RESPONSE_KEYS, state, "$");
    if (!keyResult.ok) {
      return keyResult;
    }

    const cloned = cloneRecord(input);
    const redactResult = await redactResponseRecord(cloned, state);
    if (!redactResult.ok) {
      return redactResult;
    }

    return success(cloned as T, state);
  } catch {
    return unsupportedShape(state);
  }
}

export function redactOpenAICompatibleStreamEvent<T>(
  _input: T,
): RedactionResult<OpenAICompatibleStreamRedactionMetadata> {
  const warnings: RedactionWarning[] = [{ code: "streaming_content_omitted" }];
  return {
    ok: true,
    value: {
      contentOmitted: true,
      warningCode: "streaming_content_omitted",
    },
    report: {
      status: "unchanged",
      totalRedactions: 0,
      countsByReason: {},
      warnings,
    },
    warnings,
  };
}

async function redactRequestRecord(
  record: MutableRecord,
  state: AdapterState,
): Promise<RedactionResult<MutableRecord>> {
  if (
    !("messages" in record) &&
    !("prompt" in record) &&
    !("input" in record)
  ) {
    return unsupportedShape(state);
  }

  if ("messages" in record) {
    const result = await redactMessages(record.messages, state);
    if (!result.ok) {
      return result;
    }
    record.messages = result.value;
  }

  if ("prompt" in record) {
    const result = await redactStringOrStringArray(record.prompt, state);
    if (!result.ok) {
      return result;
    }
    record.prompt = result.value;
  }

  if ("input" in record) {
    const result = await redactInputField(record.input, state);
    if (!result.ok) {
      return result;
    }
    record.input = result.value;
  }

  if ("response_format" in record) {
    const result = await redactStructuredMetadata(
      record.response_format,
      state,
      "$.response_format",
    );
    if (!result.ok) {
      return result;
    }
    record.response_format = result.value;
  }

  return success(record, state);
}

async function redactResponseRecord(
  record: MutableRecord,
  state: AdapterState,
): Promise<RedactionResult<MutableRecord>> {
  if (!Array.isArray(record.choices)) {
    return unsupportedShape(state, "$.choices");
  }

  const choices: unknown[] = [];
  for (const [index, choice] of record.choices.entries()) {
    if (!isRecord(choice)) {
      return unsupportedShape(state, `$.choices[${index}]`);
    }

    const keyResult = validateAllowedKeys(
      choice,
      CHOICE_KEYS,
      state,
      `$.choices[${index}]`,
    );
    if (!keyResult.ok) {
      return keyResult;
    }

    if (!("text" in choice) && !("message" in choice)) {
      return unsupportedShape(state, `$.choices[${index}]`);
    }

    const clonedChoice = cloneRecord(choice);

    if ("text" in clonedChoice) {
      const result = await redactStringValue(clonedChoice.text, state);
      if (!result.ok) {
        return result;
      }
      clonedChoice.text = result.value;
    }

    if ("message" in clonedChoice) {
      const result = await redactMessage(
        clonedChoice.message,
        state,
        `$.choices[${index}].message`,
      );
      if (!result.ok) {
        return result;
      }
      clonedChoice.message = result.value;
    }

    choices.push(clonedChoice);
  }

  record.choices = choices;

  if ("usage" in record) {
    const result = await redactStructuredMetadata(
      record.usage,
      state,
      "$.usage",
    );
    if (!result.ok) {
      return result;
    }
    record.usage = result.value;
  }

  return success(record, state);
}

async function redactStructuredMetadata(
  value: unknown,
  state: AdapterState,
  path: string,
): Promise<RedactionResult<unknown>> {
  if (!isRecord(value)) {
    return unsupportedShape(state, path);
  }

  const result = await redactJsonLike(value, redactionForCurrentBudget(state));
  if (!result.ok) {
    return failureFromResult(result, state);
  }

  recordCoreReport(state, result.report);
  return success(result.value, state);
}

async function redactMessages(
  value: unknown,
  state: AdapterState,
): Promise<RedactionResult<unknown>> {
  if (!Array.isArray(value)) {
    return unsupportedShape(state, "$.messages");
  }

  const messages: unknown[] = [];
  for (const [index, message] of value.entries()) {
    const result = await redactMessage(message, state, `$.messages[${index}]`);
    if (!result.ok) {
      return result;
    }
    messages.push(result.value);
  }

  return success(messages, state);
}

async function redactMessage(
  value: unknown,
  state: AdapterState,
  path: string,
): Promise<RedactionResult<unknown>> {
  if (!isRecord(value)) {
    return unsupportedShape(state, path);
  }

  const keyResult = validateAllowedKeys(value, MESSAGE_KEYS, state, path);
  if (!keyResult.ok) {
    return keyResult;
  }

  const message = cloneRecord(value);

  if ("content" in message) {
    const result = await redactContent(
      message.content,
      state,
      `${path}.content`,
    );
    if (!result.ok) {
      return result;
    }
    message.content = result.value;
  }

  if ("tool_calls" in message) {
    const result = await redactToolCalls(
      message.tool_calls,
      state,
      `${path}.tool_calls`,
    );
    if (!result.ok) {
      return result;
    }
    message.tool_calls = result.value;
  }

  return success(message, state);
}

async function redactContent(
  value: unknown,
  state: AdapterState,
  path: string,
): Promise<RedactionResult<unknown>> {
  if (typeof value === "string") {
    return redactStringValue(value, state);
  }

  if (Array.isArray(value)) {
    const parts: unknown[] = [];
    for (const [index, part] of value.entries()) {
      if (!isRecord(part)) {
        return unsupportedShape(state, `${path}[${index}]`);
      }

      const result = await redactJsonLike(
        part,
        redactionForCurrentBudget(state),
      );
      if (!result.ok) {
        return failureFromResult(result, state);
      }
      recordCoreReport(state, result.report);
      parts.push(result.value);
    }
    return success(parts, state);
  }

  if (value == null) {
    return success(value, state);
  }

  if (isRecord(value)) {
    const result = await redactJsonLike(
      value,
      redactionForCurrentBudget(state),
    );
    if (!result.ok) {
      return failureFromResult(result, state);
    }
    recordCoreReport(state, result.report);
    return success(result.value, state);
  }

  return unsupportedShape(state, path);
}

async function redactToolCalls(
  value: unknown,
  state: AdapterState,
  path: string,
): Promise<RedactionResult<unknown>> {
  if (!Array.isArray(value)) {
    return unsupportedShape(state, path);
  }

  const toolCalls: unknown[] = [];
  for (const [index, toolCall] of value.entries()) {
    if (!isRecord(toolCall)) {
      return unsupportedShape(state, `${path}[${index}]`);
    }

    const keyResult = validateAllowedKeys(
      toolCall,
      TOOL_CALL_KEYS,
      state,
      `${path}[${index}]`,
    );
    if (!keyResult.ok) {
      return keyResult;
    }

    const clonedToolCall = cloneRecord(toolCall);
    if ("function" in clonedToolCall && !isRecord(clonedToolCall.function)) {
      return unsupportedShape(state, `${path}[${index}].function`);
    }

    if (isRecord(clonedToolCall.function)) {
      const functionKeyResult = validateAllowedKeys(
        clonedToolCall.function,
        FUNCTION_KEYS,
        state,
        `${path}[${index}].function`,
      );
      if (!functionKeyResult.ok) {
        return functionKeyResult;
      }

      const fn = cloneRecord(clonedToolCall.function);

      if (state.redactToolNames && typeof fn.name === "string") {
        const result = await redactStringValue(fn.name, state);
        if (!result.ok) {
          return result;
        }
        fn.name = result.value;
      }

      if ("arguments" in fn) {
        const result = await redactToolArgumentsValue(
          fn.arguments,
          state,
          `${path}[${index}].function.arguments`,
        );
        if (!result.ok) {
          return result;
        }
        fn.arguments = result.value;
      }

      clonedToolCall.function = fn;
    }

    toolCalls.push(clonedToolCall);
  }

  return success(toolCalls, state);
}

async function redactToolArgumentsValue(
  value: unknown,
  state: AdapterState,
  path: string,
): Promise<RedactionResult<unknown>> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      const result = await redactToolArguments(
        parsed,
        redactionForCurrentBudget(state),
      );
      if (!result.ok) {
        return failureFromResult(result, state);
      }
      recordCoreReport(state, result.report);
      return success(JSON.stringify(result.value), state);
    } catch (error) {
      if (error instanceof SyntaxError) {
        state.warnings.push({ code: "malformed_tool_arguments", path });
        return redactStringValue(value, state);
      }
      throw error;
    }
  }

  const result = await redactToolArguments(
    value,
    redactionForCurrentBudget(state),
  );
  if (!result.ok) {
    return failureFromResult(result, state);
  }
  recordCoreReport(state, result.report);
  return success(result.value, state);
}

async function redactInputField(
  value: unknown,
  state: AdapterState,
): Promise<RedactionResult<unknown>> {
  if (typeof value === "string") {
    return redactStringValue(value, state);
  }

  if (Array.isArray(value) || isRecord(value)) {
    const result = await redactJsonLike(
      value,
      redactionForCurrentBudget(state),
    );
    if (!result.ok) {
      return failureFromResult(result, state);
    }
    recordCoreReport(state, result.report);
    return success(result.value, state);
  }

  if (value == null) {
    return success(value, state);
  }

  return unsupportedShape(state, "$.input");
}

async function redactStringOrStringArray(
  value: unknown,
  state: AdapterState,
): Promise<RedactionResult<unknown>> {
  if (typeof value === "string") {
    return redactStringValue(value, state);
  }

  if (Array.isArray(value)) {
    const values: unknown[] = [];
    for (const [index, item] of value.entries()) {
      if (typeof item !== "string") {
        return unsupportedShape(state, `$.prompt[${index}]`);
      }

      const result = await redactStringValue(item, state);
      if (!result.ok) {
        return result;
      }
      values.push(result.value);
    }
    return success(values, state);
  }

  return unsupportedShape(state, "$.prompt");
}

async function redactStringValue(
  value: unknown,
  state: AdapterState,
): Promise<RedactionResult<unknown>> {
  if (typeof value !== "string") {
    return success(value, state);
  }

  if (state.totalNodes + 1 > state.maxTotalNodes) {
    state.warnings.push({ code: "max_total_nodes_exceeded" });
    return createFailure(
      state,
      "max_total_nodes_exceeded",
      "Node count exceeded the configured redaction limit.",
    );
  }

  if (state.totalStringLength + value.length > state.maxTotalStringLength) {
    state.warnings.push({ code: "max_total_string_length_exceeded" });
    return createFailure(
      state,
      "max_total_string_length_exceeded",
      "Total string length exceeded the configured redaction limit.",
    );
  }

  if (state.detectorRuns + state.detectorCount > state.maxDetectorRuns) {
    state.warnings.push({ code: "max_detector_runs_exceeded" });
    return createFailure(
      state,
      "max_detector_runs_exceeded",
      "Detector execution count exceeded the configured redaction limit.",
    );
  }

  const result = await redactText(value, redactionForCurrentBudget(state));
  if (!result.ok) {
    return failureFromResult(result, state);
  }

  recordCoreReport(state, result.report);
  return success(result.value, state);
}

function createAdapterState(
  options: OpenAICompatibleOptions,
):
  | { ok: true; value: AdapterState }
  | { ok: false; failure: RedactionResult<never> } {
  try {
    if (!isRecord(options)) {
      return { ok: false, failure: invalidAdapterOptions() };
    }

    const { redactToolNames = false, ...operationOptions } = options;
    if (typeof redactToolNames !== "boolean") {
      return { ok: false, failure: invalidAdapterOptions() };
    }

    const redactionResult = resolveRedactionOperationOptions(operationOptions);
    if (!redactionResult.ok) {
      return { ok: false, failure: invalidAdapterOptions() };
    }

    const redaction = redactionResult.value;
    const totalDeadlineEpochMs = totalDeadlineFromOptions(redaction);
    const maxTotalDetections =
      redaction.limits?.maxTotalDetections ?? DEFAULT_MAX_TOTAL_DETECTIONS;
    const maxDetectorRuns =
      redaction.limits?.maxDetectorRuns ?? DEFAULT_MAX_DETECTOR_RUNS;
    const maxTotalNodes =
      redaction.limits?.maxTotalNodes ?? DEFAULT_MAX_TOTAL_NODES;
    const maxTotalStringLength =
      redaction.limits?.maxTotalStringLength ?? DEFAULT_MAX_TOTAL_STRING_LENGTH;

    return {
      ok: true,
      value: {
        redaction,
        totalDeadlineEpochMs,
        maxTotalDetections,
        maxDetectorRuns,
        maxTotalNodes,
        maxTotalStringLength,
        totalDetections: 0,
        detectorRuns: 0,
        totalNodes: 0,
        totalStringLength: 0,
        detectorCount: detectorCount(redaction),
        redactToolNames,
        reportAccumulator: createRedactionReportAccumulator(),
        warnings: [],
      },
    };
  } catch {
    return { ok: false, failure: invalidAdapterOptions() };
  }
}

function invalidAdapterOptions<T>(): RedactionResult<T> {
  const state: AdapterState = {
    redaction: {},
    totalDeadlineEpochMs: undefined,
    maxTotalDetections: DEFAULT_MAX_TOTAL_DETECTIONS,
    maxDetectorRuns: DEFAULT_MAX_DETECTOR_RUNS,
    maxTotalNodes: DEFAULT_MAX_TOTAL_NODES,
    maxTotalStringLength: DEFAULT_MAX_TOTAL_STRING_LENGTH,
    totalDetections: 0,
    detectorRuns: 0,
    totalNodes: 0,
    totalStringLength: 0,
    detectorCount: 4,
    redactToolNames: false,
    reportAccumulator: createRedactionReportAccumulator(),
    warnings: [{ code: "invalid_redaction_options" }],
  };
  return createFailure(
    state,
    "invalid_redaction_options",
    "OpenAI-compatible redaction options are invalid.",
  );
}

function totalDeadlineFromOptions(options: RedactionOptions) {
  const maxTotalDurationMs = options.limits?.maxTotalDurationMs;
  return maxTotalDurationMs === undefined
    ? undefined
    : Date.now() + Math.max(0, maxTotalDurationMs);
}

function redactionForCurrentBudget(state: AdapterState): RedactionOptions {
  return {
    ...state.redaction,
    limits: {
      ...state.redaction.limits,
      maxTotalDetections: Math.max(
        0,
        state.maxTotalDetections - state.totalDetections,
      ),
      maxDetectorRuns: Math.max(0, state.maxDetectorRuns - state.detectorRuns),
      maxTotalNodes: Math.max(0, state.maxTotalNodes - state.totalNodes),
      maxTotalStringLength: Math.max(
        0,
        state.maxTotalStringLength - state.totalStringLength,
      ),
      ...(state.totalDeadlineEpochMs === undefined
        ? {}
        : {
            maxTotalDurationMs: Math.max(
              0,
              state.totalDeadlineEpochMs - Date.now(),
            ),
          }),
    },
  };
}

function recordCoreReport(state: AdapterState, report: RedactionReport) {
  state.totalDetections += report.totalRedactions;
  state.detectorRuns += report.timings?.detectorRuns ?? 0;
  state.totalNodes += report.timings?.nodesVisited ?? 0;
  state.totalStringLength += report.timings?.stringCodeUnits ?? 0;
  state.reportAccumulator.add(report);
}

function detectorCount(options: RedactionOptions) {
  const builtInCount =
    options.builtInDetectors === false
      ? 0
      : (options.builtInDetectors?.length ?? 4);
  return builtInCount + (options.detectors?.length ?? 0);
}

function success<T>(value: T, state: AdapterState): RedactionResult<T> {
  const report = snapshotAdapterReport(state);
  return {
    ok: true,
    value,
    report,
    warnings: report.warnings,
  };
}

function unsupportedShape<T>(
  state: AdapterState,
  path = "$",
): RedactionResult<T> {
  state.warnings.push({ code: "unsupported_provider_shape", path });
  return createFailure(
    state,
    "unsupported_provider_shape",
    "Unsupported OpenAI-compatible shape; content-bearing fields were not exported.",
  );
}

function isRecord(value: unknown): value is MutableRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneRecord<T extends MutableRecord>(value: T): T {
  return { ...value };
}

function createFailure<T>(
  state: AdapterState,
  code: SafeRedactionError["code"],
  message: string,
): RedactionResult<T> {
  state.reportAccumulator.markFailed();
  const report = snapshotAdapterReport(state);

  return {
    ok: false,
    report,
    warnings: report.warnings,
    error: {
      code,
      message,
    },
  };
}

function snapshotAdapterReport(state: AdapterState): RedactionReport {
  const report = state.reportAccumulator.snapshot();
  return {
    ...report,
    warnings: [...report.warnings, ...state.warnings],
  };
}

function failureFromResult<T>(
  result: Extract<RedactionResult<T>, { ok: false }>,
  state: AdapterState,
): RedactionResult<never> {
  state.reportAccumulator.add(result.report);
  const report = snapshotAdapterReport(state);
  return {
    ok: false,
    report,
    warnings: report.warnings,
    error: result.error,
  };
}

function validateAllowedKeys(
  record: MutableRecord,
  allowedKeys: ReadonlySet<string>,
  state: AdapterState,
  path: string,
): RedactionResult<void> {
  const keys = Object.keys(record);
  for (const [index, key] of keys.entries()) {
    if (!allowedKeys.has(key)) {
      return unsupportedShape(state, `${path}.{${index}}`);
    }
  }

  return success(undefined, state);
}
