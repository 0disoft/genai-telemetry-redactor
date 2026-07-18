import {
  redactJsonLike,
  redactText,
  redactToolArguments,
  type RedactionOptions,
  type RedactionReport,
  type RedactionResult,
  type RedactionWarning,
  type SafeRedactionError,
} from "../../core/src/index.js";
import { resolveRedactionOperationOptions } from "../../core/src/redaction-profile.js";
import {
  createRedactionReportAccumulator,
  type RedactionReportAccumulator,
} from "../../core/src/report.js";
import type { AnthropicMessagesOptions } from "./types.js";

type MutableRecord = Record<string, unknown>;
type MessageRole = "assistant" | "user";
type ContentBoundary = "request" | "response";

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
  "max_tokens",
  "messages",
  "metadata",
  "model",
  "stop_sequences",
  "stream",
  "system",
  "temperature",
  "tool_choice",
  "tools",
  "top_k",
  "top_p",
]);
const RESPONSE_KEYS = new Set([
  "content",
  "id",
  "model",
  "role",
  "stop_reason",
  "stop_sequence",
  "type",
  "usage",
]);
const MESSAGE_KEYS = new Set(["content", "role"]);
const TEXT_BLOCK_KEYS = new Set(["text", "type"]);
const TOOL_USE_BLOCK_KEYS = new Set(["id", "input", "name", "type"]);
const TOOL_RESULT_BLOCK_KEYS = new Set([
  "content",
  "is_error",
  "tool_use_id",
  "type",
]);

export async function redactAnthropicMessagesRequest<T>(
  input: T,
  options: AnthropicMessagesOptions = {},
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
    if (!validateRequestMetadata(input)) {
      return unsupportedShape(state);
    }
    if (!("messages" in input)) {
      return unsupportedShape(state, "$.messages");
    }

    const cloned: MutableRecord = cloneRecord(input);
    const messages = await redactMessages(cloned.messages, state);
    if (!messages.ok) {
      return messages;
    }
    cloned.messages = messages.value;

    if ("system" in cloned) {
      const system = await redactSystem(cloned.system, state);
      if (!system.ok) {
        return system;
      }
      cloned.system = system.value;
    }

    for (const key of [
      "metadata",
      "stop_sequences",
      "tool_choice",
      "tools",
    ] as const) {
      if (!(key in cloned)) {
        continue;
      }
      const structured = await redactStructured(cloned[key], state, `$.${key}`);
      if (!structured.ok) {
        return structured;
      }
      cloned[key] = structured.value;
    }

    return success(cloned as T, state);
  } catch {
    return unsupportedShape(state);
  }
}

export async function redactAnthropicMessagesResponse<T>(
  input: T,
  options: AnthropicMessagesOptions = {},
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
    if (!validateResponseMetadata(input) || !("content" in input)) {
      return unsupportedShape(state);
    }

    const cloned: MutableRecord = cloneRecord(input);
    const content = await redactContentBlocks(
      cloned.content,
      state,
      "$.content",
      "assistant",
      "response",
    );
    if (!content.ok) {
      return content;
    }
    cloned.content = content.value;

    if ("usage" in cloned) {
      const usage = await redactStructured(cloned.usage, state, "$.usage");
      if (!usage.ok) {
        return usage;
      }
      cloned.usage = usage.value;
    }

    return success(cloned as T, state);
  } catch {
    return unsupportedShape(state);
  }
}

async function redactSystem(
  value: unknown,
  state: AdapterState,
): Promise<RedactionResult<unknown>> {
  if (typeof value === "string") {
    return redactString(value, state, "$.system");
  }
  return redactTextBlocks(value, state, "$.system");
}

async function redactMessages(
  value: unknown,
  state: AdapterState,
): Promise<RedactionResult<unknown>> {
  if (!Array.isArray(value)) {
    return unsupportedShape(state, "$.messages");
  }

  const messages: unknown[] = [];
  for (const [index, candidate] of value.entries()) {
    const path = `$.messages[${index}]`;
    if (!isRecord(candidate)) {
      return unsupportedShape(state, path);
    }
    const keyResult = validateAllowedKeys(candidate, MESSAGE_KEYS, state, path);
    if (!keyResult.ok) {
      return keyResult;
    }
    if (
      (candidate.role !== "user" && candidate.role !== "assistant") ||
      !("content" in candidate)
    ) {
      return unsupportedShape(state, path);
    }

    const message = cloneRecord(candidate);
    const content =
      typeof message.content === "string"
        ? await redactString(message.content, state, `${path}.content`)
        : await redactContentBlocks(
            message.content,
            state,
            `${path}.content`,
            candidate.role,
            "request",
          );
    if (!content.ok) {
      return content;
    }
    message.content = content.value;
    messages.push(message);
  }

  return success(messages, state);
}

async function redactContentBlocks(
  value: unknown,
  state: AdapterState,
  path: string,
  role: MessageRole,
  boundary: ContentBoundary,
): Promise<RedactionResult<unknown>> {
  if (!Array.isArray(value)) {
    return unsupportedShape(state, path);
  }

  const blocks: unknown[] = [];
  for (const [index, candidate] of value.entries()) {
    const blockPath = `${path}[${index}]`;
    if (!isRecord(candidate)) {
      return unsupportedShape(state, blockPath);
    }

    switch (candidate.type) {
      case "text": {
        const text = await redactTextBlock(candidate, state, blockPath);
        if (!text.ok) {
          return text;
        }
        blocks.push(text.value);
        break;
      }
      case "tool_use": {
        if (role !== "assistant") {
          return unsupportedShape(state, blockPath);
        }
        const toolUse = await redactToolUseBlock(candidate, state, blockPath);
        if (!toolUse.ok) {
          return toolUse;
        }
        blocks.push(toolUse.value);
        break;
      }
      case "tool_result": {
        if (role !== "user" || boundary !== "request") {
          return unsupportedShape(state, blockPath);
        }
        const toolResult = await redactToolResultBlock(
          candidate,
          state,
          blockPath,
        );
        if (!toolResult.ok) {
          return toolResult;
        }
        blocks.push(toolResult.value);
        break;
      }
      default:
        return unsupportedShape(state, blockPath);
    }
  }

  return success(blocks, state);
}

async function redactTextBlocks(
  value: unknown,
  state: AdapterState,
  path: string,
): Promise<RedactionResult<unknown>> {
  if (!Array.isArray(value)) {
    return unsupportedShape(state, path);
  }

  const blocks: unknown[] = [];
  for (const [index, candidate] of value.entries()) {
    if (!isRecord(candidate) || candidate.type !== "text") {
      return unsupportedShape(state, `${path}[${index}]`);
    }
    const result = await redactTextBlock(candidate, state, `${path}[${index}]`);
    if (!result.ok) {
      return result;
    }
    blocks.push(result.value);
  }
  return success(blocks, state);
}

async function redactTextBlock(
  value: MutableRecord,
  state: AdapterState,
  path: string,
): Promise<RedactionResult<unknown>> {
  const keyResult = validateAllowedKeys(value, TEXT_BLOCK_KEYS, state, path);
  if (!keyResult.ok) {
    return keyResult;
  }
  if (value.type !== "text" || typeof value.text !== "string") {
    return unsupportedShape(state, path);
  }

  const block = cloneRecord(value);
  const text = await redactString(value.text, state, `${path}.text`);
  if (!text.ok) {
    return text;
  }
  block.text = text.value;
  return success(block, state);
}

async function redactToolUseBlock(
  value: MutableRecord,
  state: AdapterState,
  path: string,
): Promise<RedactionResult<unknown>> {
  const keyResult = validateAllowedKeys(
    value,
    TOOL_USE_BLOCK_KEYS,
    state,
    path,
  );
  if (!keyResult.ok) {
    return keyResult;
  }
  if (
    value.type !== "tool_use" ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !isRecord(value.input)
  ) {
    return unsupportedShape(state, path);
  }

  const block = cloneRecord(value);
  if (state.redactToolNames) {
    const name = await redactString(value.name, state, `${path}.name`);
    if (!name.ok) {
      return name;
    }
    block.name = name.value;
  }

  const input = await redactToolArguments(
    value.input,
    redactionForCurrentBudget(state),
  );
  if (!input.ok) {
    return failureFromResult(input, state);
  }
  recordCoreReport(state, input.report);
  block.input = input.value;
  return success(block, state);
}

async function redactToolResultBlock(
  value: MutableRecord,
  state: AdapterState,
  path: string,
): Promise<RedactionResult<unknown>> {
  const keyResult = validateAllowedKeys(
    value,
    TOOL_RESULT_BLOCK_KEYS,
    state,
    path,
  );
  if (!keyResult.ok) {
    return keyResult;
  }
  if (
    value.type !== "tool_result" ||
    typeof value.tool_use_id !== "string" ||
    !isOptionalBoolean(value.is_error)
  ) {
    return unsupportedShape(state, path);
  }

  const block = cloneRecord(value);
  if ("content" in value) {
    const content =
      typeof value.content === "string"
        ? await redactString(value.content, state, `${path}.content`)
        : await redactTextBlocks(value.content, state, `${path}.content`);
    if (!content.ok) {
      return content;
    }
    block.content = content.value;
  }
  return success(block, state);
}

async function redactStructured(
  value: unknown,
  state: AdapterState,
  path: string,
): Promise<RedactionResult<unknown>> {
  if (!Array.isArray(value) && !isRecord(value)) {
    return unsupportedShape(state, path);
  }
  const result = await redactJsonLike(value, redactionForCurrentBudget(state));
  if (!result.ok) {
    return failureFromResult(result, state);
  }
  recordCoreReport(state, result.report);
  return success(result.value, state);
}

async function redactString(
  value: string,
  state: AdapterState,
  path: string,
): Promise<RedactionResult<unknown>> {
  if (state.totalNodes + 1 > state.maxTotalNodes) {
    state.warnings.push({ code: "max_total_nodes_exceeded", path });
    return createFailure(
      state,
      "max_total_nodes_exceeded",
      "Node count exceeded the configured redaction limit.",
    );
  }
  if (state.totalStringLength + value.length > state.maxTotalStringLength) {
    state.warnings.push({ code: "max_total_string_length_exceeded", path });
    return createFailure(
      state,
      "max_total_string_length_exceeded",
      "Total string length exceeded the configured redaction limit.",
    );
  }
  if (state.detectorRuns + state.detectorCount > state.maxDetectorRuns) {
    state.warnings.push({ code: "max_detector_runs_exceeded", path });
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
  options: AnthropicMessagesOptions,
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
    return {
      ok: true,
      value: {
        redaction,
        totalDeadlineEpochMs: totalDeadlineFromOptions(redaction),
        maxTotalDetections:
          redaction.limits?.maxTotalDetections ?? DEFAULT_MAX_TOTAL_DETECTIONS,
        maxDetectorRuns:
          redaction.limits?.maxDetectorRuns ?? DEFAULT_MAX_DETECTOR_RUNS,
        maxTotalNodes:
          redaction.limits?.maxTotalNodes ?? DEFAULT_MAX_TOTAL_NODES,
        maxTotalStringLength:
          redaction.limits?.maxTotalStringLength ??
          DEFAULT_MAX_TOTAL_STRING_LENGTH,
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
    "Anthropic Messages redaction options are invalid.",
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

function validateRequestMetadata(record: MutableRecord) {
  return (
    isOptionalString(record.model) &&
    isOptionalInteger(record.max_tokens) &&
    isOptionalBoolean(record.stream) &&
    isOptionalFiniteNumber(record.temperature) &&
    isOptionalInteger(record.top_k) &&
    isOptionalFiniteNumber(record.top_p)
  );
}

function validateResponseMetadata(record: MutableRecord) {
  return (
    isOptionalString(record.id) &&
    isOptionalString(record.type) &&
    (record.role === undefined || record.role === "assistant") &&
    isOptionalString(record.model) &&
    isOptionalStringOrNull(record.stop_reason) &&
    isOptionalStringOrNull(record.stop_sequence)
  );
}

function validateAllowedKeys(
  record: MutableRecord,
  allowedKeys: ReadonlySet<string>,
  state: AdapterState,
  path: string,
): RedactionResult<void> {
  const prototype = Object.getPrototypeOf(record);
  if (prototype !== Object.prototype && prototype !== null) {
    return unsupportedShape(state, path);
  }
  const keys = Reflect.ownKeys(record);
  const descriptors = Object.getOwnPropertyDescriptors(record);
  for (const [index, key] of keys.entries()) {
    if (typeof key !== "string") {
      return unsupportedShape(state, `${path}.{${index}}`);
    }
    const descriptor = descriptors[key];
    if (
      !descriptor?.enumerable ||
      !("value" in descriptor) ||
      !allowedKeys.has(key)
    ) {
      return unsupportedShape(state, `${path}.{${index}}`);
    }
  }
  return success(undefined, state);
}

function success<T>(value: T, state: AdapterState): RedactionResult<T> {
  const report = snapshotAdapterReport(state);
  return { ok: true, value, report, warnings: report.warnings };
}

function unsupportedShape<T>(
  state: AdapterState,
  path = "$",
): RedactionResult<T> {
  state.warnings.push({ code: "unsupported_provider_shape", path });
  return createFailure(
    state,
    "unsupported_provider_shape",
    "Unsupported Anthropic Messages shape; content-bearing fields were not exported.",
  );
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
    error: { code, message },
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

function snapshotAdapterReport(state: AdapterState): RedactionReport {
  const report = state.reportAccumulator.snapshot();
  return { ...report, warnings: [...report.warnings, ...state.warnings] };
}

function isRecord(value: unknown): value is MutableRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneRecord<T extends MutableRecord>(value: T): T {
  const clone: MutableRecord = {};
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Object.keys(descriptors)) {
    const descriptor = descriptors[key];
    if (descriptor && "value" in descriptor && descriptor.value !== undefined) {
      Object.defineProperty(clone, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: descriptor.value,
      });
    }
  }
  return clone as T;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isOptionalStringOrNull(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

function isOptionalFiniteNumber(value: unknown): boolean {
  return (
    value === undefined || (typeof value === "number" && Number.isFinite(value))
  );
}

function isOptionalInteger(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === "number" && Number.isInteger(value))
  );
}
