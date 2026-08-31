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
  createEmptyReport,
  type RedactionReportAccumulator,
} from "../../core/src/report.js";
import type {
  OpenAICompatibleOptions,
  OpenAICompatibleStreamChoice,
  OpenAICompatibleStreamFinalResult,
  OpenAICompatibleStreamOptions,
  OpenAICompatibleStreamRedactor,
  OpenAICompatibleStreamRedactionMetadata,
  OpenAICompatibleStreamToolCall,
} from "./types.js";
import {
  LosslessJsonToolArgumentsError,
  redactJsonToolArgumentsString,
} from "./lossless-json-tool-arguments.js";

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
const TOOL_CALL_KEYS = new Set(["index", "id", "type", "function"]);
const FUNCTION_KEYS = new Set(["name", "arguments"]);
const STREAM_EVENT_KEYS = new Set([
  "id",
  "object",
  "created",
  "model",
  "choices",
  "usage",
  "system_fingerprint",
]);
const STREAM_CHOICE_KEYS = new Set(["index", "delta", "text", "finish_reason"]);
const STREAM_DELTA_KEYS = new Set(["role", "content", "tool_calls"]);
const STREAM_TOOL_CALL_KEYS = new Set(["index", "id", "type", "function"]);
const STREAM_FUNCTION_KEYS = new Set(["name", "arguments"]);
const DEFAULT_MAX_STREAM_BUFFER_LENGTH = 65_536;

type OpenAICompatibleStreamState = {
  adapter: AdapterState;
  choices: Map<number, OpenAICompatibleStreamChoiceState>;
  maxStreamBufferLength: number;
  closed: boolean;
  failed: RedactionResult<never> | undefined;
};

type OpenAICompatibleStreamChoiceState = {
  index: number;
  role: string | undefined;
  content: string;
  text: string;
  sawContent: boolean;
  sawText: boolean;
  finishReason: string | null | undefined;
  finished: boolean;
  toolCalls: Map<number, OpenAICompatibleStreamToolCallState>;
};

type OpenAICompatibleStreamToolCallState = {
  index: number;
  id: string | undefined;
  type: string | undefined;
  name: string | undefined;
  arguments: string;
  sawArguments: boolean;
};

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

    const metadataResult = validateRequestMetadata(input, state);
    if (!metadataResult.ok) {
      return metadataResult;
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

    const metadataResult = validateResponseMetadata(input, state);
    if (!metadataResult.ok) {
      return metadataResult;
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
  return omittedStreamEvent();
}

export function createOpenAICompatibleStreamRedactor(
  options: OpenAICompatibleStreamOptions = {},
): OpenAICompatibleStreamRedactor {
  const streamStateResult = createOpenAICompatibleStreamState(options);
  if (!streamStateResult.ok) {
    return failedOpenAICompatibleStreamRedactor(streamStateResult.failure);
  }

  if (!streamStateResult.value.captureContent) {
    return metadataOnlyOpenAICompatibleStreamRedactor();
  }

  const stream = streamStateResult.value.stream;

  return {
    push(input) {
      if (stream.failed) {
        return stream.failed;
      }
      if (stream.closed) {
        return streamFailure(
          "stream_closed",
          "OpenAI-compatible stream redaction cannot accept events after close.",
        );
      }

      const appendResult = appendOpenAICompatibleStreamEvent(input, stream);
      if (!appendResult.ok) {
        stream.failed = appendResult;
        stream.choices.clear();
        return appendResult;
      }
      return omittedStreamEvent();
    },
    async close() {
      if (stream.failed) {
        return stream.failed;
      }
      if (stream.closed) {
        return streamFailure(
          "stream_already_closed",
          "OpenAI-compatible stream redaction has already been closed.",
        );
      }

      stream.closed = true;
      return finalizeOpenAICompatibleStream(stream);
    },
  };
}

function metadataOnlyOpenAICompatibleStreamRedactor(): OpenAICompatibleStreamRedactor {
  let closed = false;

  return {
    push(input) {
      if (closed) {
        return streamFailure(
          "stream_closed",
          "OpenAI-compatible stream redaction cannot accept events after close.",
        );
      }
      return redactOpenAICompatibleStreamEvent(input);
    },
    async close() {
      if (closed) {
        return streamFailure(
          "stream_already_closed",
          "OpenAI-compatible stream redaction has already been closed.",
        );
      }
      closed = true;
      return omittedStreamEvent();
    },
  };
}

function failedOpenAICompatibleStreamRedactor(
  failure: RedactionResult<never>,
): OpenAICompatibleStreamRedactor {
  return {
    push() {
      return failure;
    },
    async close() {
      return failure;
    },
  };
}

function omittedStreamEvent(): RedactionResult<OpenAICompatibleStreamRedactionMetadata> {
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

function createOpenAICompatibleStreamState(
  options: OpenAICompatibleStreamOptions,
):
  | {
      ok: true;
      value:
        | { captureContent: false }
        | { captureContent: true; stream: OpenAICompatibleStreamState };
    }
  | { ok: false; failure: RedactionResult<never> } {
  if (!isRecord(options)) {
    return { ok: false, failure: invalidAdapterOptions() };
  }

  const { captureContent = false, ...adapterOptions } = options;
  if (typeof captureContent !== "boolean") {
    return { ok: false, failure: invalidAdapterOptions() };
  }

  const adapterStateResult = createAdapterState(
    adapterOptions as OpenAICompatibleOptions,
  );
  if (!adapterStateResult.ok) {
    return { ok: false, failure: adapterStateResult.failure };
  }
  if (!captureContent) {
    return { ok: true, value: { captureContent } };
  }

  return {
    ok: true,
    value: {
      captureContent: true,
      stream: {
        adapter: adapterStateResult.value,
        choices: new Map(),
        maxStreamBufferLength: Math.max(
          0,
          adapterStateResult.value.redaction.limits?.maxStreamBufferLength ??
            DEFAULT_MAX_STREAM_BUFFER_LENGTH,
        ),
        closed: false,
        failed: undefined,
      },
    },
  };
}

function appendOpenAICompatibleStreamEvent(
  input: unknown,
  stream: OpenAICompatibleStreamState,
): RedactionResult<void> {
  const state = stream.adapter;

  try {
    if (!isRecord(input)) {
      return unsupportedShape(state);
    }

    const keyResult = validateAllowedKeys(input, STREAM_EVENT_KEYS, state, "$");
    if (!keyResult.ok) {
      return keyResult;
    }

    const metadataResult = validateResponseMetadata(input, state);
    if (!metadataResult.ok) {
      return metadataResult;
    }

    if (!Array.isArray(input.choices)) {
      return unsupportedShape(state, "$.choices");
    }

    const seenChoiceIndexes = new Set<number>();
    for (const [choicePosition, rawChoice] of input.choices.entries()) {
      if (!isRecord(rawChoice)) {
        return unsupportedShape(state, `$.choices[${choicePosition}]`);
      }

      const choiceKeyResult = validateAllowedKeys(
        rawChoice,
        STREAM_CHOICE_KEYS,
        state,
        `$.choices[${choicePosition}]`,
      );
      if (!choiceKeyResult.ok) {
        return choiceKeyResult;
      }

      if (!isOptionalInteger(rawChoice.index)) {
        return unsupportedShape(state, `$.choices[${choicePosition}].index`);
      }
      const choiceIndex =
        typeof rawChoice.index === "number" ? rawChoice.index : choicePosition;
      if (seenChoiceIndexes.has(choiceIndex)) {
        return unsupportedShape(state, `$.choices[${choicePosition}].index`);
      }
      seenChoiceIndexes.add(choiceIndex);

      const choiceStateResult = choiceStateFor(
        stream,
        choiceIndex,
        `$.choices[${choicePosition}]`,
      );
      if (!choiceStateResult.ok) {
        return choiceStateResult;
      }
      const choiceState = choiceStateResult.value;
      if (choiceState.finished && choiceHasContent(rawChoice)) {
        return unsupportedShape(state, `$.choices[${choicePosition}]`);
      }

      if ("text" in rawChoice && rawChoice.text !== undefined) {
        if (typeof rawChoice.text !== "string") {
          return unsupportedShape(state, `$.choices[${choicePosition}].text`);
        }
        if (choiceState.sawContent || choiceState.toolCalls.size > 0) {
          return unsupportedShape(state, `$.choices[${choicePosition}].text`);
        }
        const appendResult = appendStreamText(
          stream,
          choiceState.text,
          rawChoice.text,
          `$.choices[${choicePosition}].text`,
        );
        if (!appendResult.ok) {
          return appendResult;
        }
        choiceState.text = appendResult.value;
        choiceState.sawText = true;
      }

      if ("delta" in rawChoice) {
        const deltaResult = appendOpenAICompatibleDelta(
          rawChoice.delta,
          stream,
          choiceState,
          `$.choices[${choicePosition}].delta`,
        );
        if (!deltaResult.ok) {
          return deltaResult;
        }
      }

      if (
        "finish_reason" in rawChoice &&
        rawChoice.finish_reason !== undefined
      ) {
        if (!isOptionalStringOrNull(rawChoice.finish_reason)) {
          return unsupportedShape(
            state,
            `$.choices[${choicePosition}].finish_reason`,
          );
        }
        if (choiceState.finished) {
          return unsupportedShape(
            state,
            `$.choices[${choicePosition}].finish_reason`,
          );
        }
        const finishReason = rawChoice.finish_reason as string | null;
        choiceState.finishReason = finishReason;
        choiceState.finished = finishReason !== null;
      }
    }

    return success(undefined, state);
  } catch {
    return unsupportedShape(state);
  }
}

function appendOpenAICompatibleDelta(
  delta: unknown,
  stream: OpenAICompatibleStreamState,
  choiceState: OpenAICompatibleStreamChoiceState,
  path: string,
): RedactionResult<void> {
  const state = stream.adapter;
  if (!isRecord(delta)) {
    return unsupportedShape(state, path);
  }

  const keyResult = validateAllowedKeys(delta, STREAM_DELTA_KEYS, state, path);
  if (!keyResult.ok) {
    return keyResult;
  }

  if ("role" in delta) {
    if (!isOptionalString(delta.role)) {
      return unsupportedShape(state, `${path}.role`);
    }
    if (
      typeof delta.role === "string" &&
      choiceState.role !== undefined &&
      choiceState.role !== delta.role
    ) {
      return unsupportedShape(state, `${path}.role`);
    }
    if (typeof delta.role === "string") {
      choiceState.role = delta.role;
    }
  }

  if (
    "content" in delta &&
    delta.content !== undefined &&
    delta.content !== null
  ) {
    if (typeof delta.content !== "string") {
      return unsupportedShape(state, `${path}.content`);
    }
    if (choiceState.sawText) {
      return unsupportedShape(state, `${path}.content`);
    }
    const appendResult = appendStreamText(
      stream,
      choiceState.content,
      delta.content,
      `${path}.content`,
    );
    if (!appendResult.ok) {
      return appendResult;
    }
    choiceState.content = appendResult.value;
    choiceState.sawContent = true;
  }

  if ("tool_calls" in delta) {
    if (!Array.isArray(delta.tool_calls)) {
      return unsupportedShape(state, `${path}.tool_calls`);
    }
    if (choiceState.sawText) {
      return unsupportedShape(state, `${path}.tool_calls`);
    }
    const seenToolIndexes = new Set<number>();
    for (const [toolPosition, rawToolCall] of delta.tool_calls.entries()) {
      const toolResult = appendOpenAICompatibleToolCall(
        rawToolCall,
        stream,
        choiceState,
        `${path}.tool_calls[${toolPosition}]`,
        seenToolIndexes,
      );
      if (!toolResult.ok) {
        return toolResult;
      }
    }
  }

  return success(undefined, state);
}

function appendOpenAICompatibleToolCall(
  rawToolCall: unknown,
  stream: OpenAICompatibleStreamState,
  choiceState: OpenAICompatibleStreamChoiceState,
  path: string,
  seenToolIndexes: Set<number>,
): RedactionResult<void> {
  const state = stream.adapter;
  if (!isRecord(rawToolCall)) {
    return unsupportedShape(state, path);
  }

  const keyResult = validateAllowedKeys(
    rawToolCall,
    STREAM_TOOL_CALL_KEYS,
    state,
    path,
  );
  if (!keyResult.ok) {
    return keyResult;
  }

  if (!isOptionalInteger(rawToolCall.index)) {
    return unsupportedShape(state, `${path}.index`);
  }
  const toolIndex =
    typeof rawToolCall.index === "number" ? rawToolCall.index : 0;
  if (seenToolIndexes.has(toolIndex)) {
    return unsupportedShape(state, `${path}.index`);
  }
  seenToolIndexes.add(toolIndex);

  const toolStateResult = toolCallStateFor(choiceState, toolIndex, state, path);
  if (!toolStateResult.ok) {
    return toolStateResult;
  }
  const toolState = toolStateResult.value;
  const idResult = rememberStableString(
    toolState.id,
    rawToolCall.id,
    `${path}.id`,
    state,
  );
  if (!idResult.ok) {
    return idResult;
  }
  toolState.id = idResult.value;

  const typeResult = rememberStableString(
    toolState.type,
    rawToolCall.type,
    `${path}.type`,
    state,
  );
  if (!typeResult.ok) {
    return typeResult;
  }
  toolState.type = typeResult.value;

  if ("function" in rawToolCall) {
    if (!isRecord(rawToolCall.function)) {
      return unsupportedShape(state, `${path}.function`);
    }
    const functionKeyResult = validateAllowedKeys(
      rawToolCall.function,
      STREAM_FUNCTION_KEYS,
      state,
      `${path}.function`,
    );
    if (!functionKeyResult.ok) {
      return functionKeyResult;
    }

    const nameResult = rememberStableString(
      toolState.name,
      rawToolCall.function.name,
      `${path}.function.name`,
      state,
    );
    if (!nameResult.ok) {
      return nameResult;
    }
    toolState.name = nameResult.value;

    if (
      "arguments" in rawToolCall.function &&
      rawToolCall.function.arguments !== undefined
    ) {
      if (typeof rawToolCall.function.arguments !== "string") {
        return unsupportedShape(state, `${path}.function.arguments`);
      }
      const appendResult = appendStreamText(
        stream,
        toolState.arguments,
        rawToolCall.function.arguments,
        `${path}.function.arguments`,
      );
      if (!appendResult.ok) {
        return appendResult;
      }
      toolState.arguments = appendResult.value;
      toolState.sawArguments = true;
    }
  }

  return success(undefined, state);
}

async function finalizeOpenAICompatibleStream(
  stream: OpenAICompatibleStreamState,
): Promise<RedactionResult<OpenAICompatibleStreamFinalResult>> {
  for (const choiceState of stream.choices.values()) {
    if (!choiceState.finished) {
      stream.choices.clear();
      stream.adapter.warnings.push({ code: "provider_stream_truncated" });
      return createFailure(
        stream.adapter,
        "provider_stream_truncated",
        "OpenAI-compatible stream ended before every choice produced a finish reason.",
      );
    }
  }

  const aggregate = buildOpenAICompatibleStreamAggregate(stream);
  stream.choices.clear();
  const result = await redactResponseRecord(aggregate, stream.adapter);
  if (!result.ok) {
    return result;
  }
  return {
    ...result,
    value: {
      contentOmitted: false,
      choices: result.value.choices as OpenAICompatibleStreamChoice[],
    },
  };
}

function buildOpenAICompatibleStreamAggregate(
  stream: OpenAICompatibleStreamState,
): MutableRecord {
  const choices: OpenAICompatibleStreamChoice[] = [];
  for (const choiceState of stream.choices.values()) {
    const choice: OpenAICompatibleStreamChoice = { index: choiceState.index };
    if (choiceState.finishReason !== undefined) {
      choice.finish_reason = choiceState.finishReason;
    }

    if (choiceState.sawText) {
      choice.text = choiceState.text;
    }

    const message: OpenAICompatibleStreamChoice["message"] = {};
    if (choiceState.role !== undefined) {
      message.role = choiceState.role;
    }
    if (choiceState.sawContent) {
      message.content = choiceState.content;
    }
    if (choiceState.toolCalls.size > 0) {
      message.tool_calls = buildOpenAICompatibleToolCalls(choiceState);
    }
    if (!choiceState.sawText) {
      choice.message = message;
    }

    choices.push(choice);
  }
  return { choices };
}

function buildOpenAICompatibleToolCalls(
  choiceState: OpenAICompatibleStreamChoiceState,
): OpenAICompatibleStreamToolCall[] {
  const toolCalls: OpenAICompatibleStreamToolCall[] = [];
  for (const toolState of choiceState.toolCalls.values()) {
    const toolCall: OpenAICompatibleStreamToolCall = {
      index: toolState.index,
    };
    if (toolState.id !== undefined) {
      toolCall.id = toolState.id;
    }
    if (toolState.type !== undefined) {
      toolCall.type = toolState.type;
    }

    const fn: NonNullable<OpenAICompatibleStreamToolCall["function"]> = {};
    if (toolState.name !== undefined) {
      fn.name = toolState.name;
    }

    if (toolState.sawArguments) {
      fn.arguments = toolState.arguments;
    }

    if (Object.keys(fn).length > 0) {
      toolCall.function = fn;
    }
    toolCalls.push(toolCall);
  }
  return toolCalls;
}

function choiceHasContent(choice: MutableRecord): boolean {
  if (typeof choice.text === "string" && choice.text.length > 0) {
    return true;
  }
  if (!isRecord(choice.delta)) {
    return false;
  }
  return (
    (typeof choice.delta.content === "string" &&
      choice.delta.content.length > 0) ||
    (Array.isArray(choice.delta.tool_calls) &&
      choice.delta.tool_calls.length > 0)
  );
}

function choiceStateFor(
  stream: OpenAICompatibleStreamState,
  index: number,
  path: string,
): RedactionResult<OpenAICompatibleStreamChoiceState> {
  const existing = stream.choices.get(index);
  if (existing) {
    return success(existing, stream.adapter);
  }
  if (stream.choices.size + 1 > stream.adapter.maxTotalNodes) {
    stream.adapter.warnings.push({ code: "max_total_nodes_exceeded", path });
    return createFailure(
      stream.adapter,
      "max_total_nodes_exceeded",
      "OpenAI-compatible stream exceeded the configured state entry limit.",
    );
  }
  const created: OpenAICompatibleStreamChoiceState = {
    index,
    role: undefined,
    content: "",
    text: "",
    sawContent: false,
    sawText: false,
    finishReason: undefined,
    finished: false,
    toolCalls: new Map(),
  };
  stream.choices.set(index, created);
  return success(created, stream.adapter);
}

function toolCallStateFor(
  choiceState: OpenAICompatibleStreamChoiceState,
  index: number,
  state: AdapterState,
  path: string,
): RedactionResult<OpenAICompatibleStreamToolCallState> {
  const existing = choiceState.toolCalls.get(index);
  if (existing) {
    return success(existing, state);
  }
  if (choiceState.toolCalls.size + 1 > state.maxTotalNodes) {
    state.warnings.push({ code: "max_total_nodes_exceeded", path });
    return createFailure(
      state,
      "max_total_nodes_exceeded",
      "OpenAI-compatible stream exceeded the configured state entry limit.",
    );
  }
  const created: OpenAICompatibleStreamToolCallState = {
    index,
    id: undefined,
    type: undefined,
    name: undefined,
    arguments: "",
    sawArguments: false,
  };
  choiceState.toolCalls.set(index, created);
  return success(created, state);
}

function rememberStableString(
  current: string | undefined,
  next: unknown,
  path: string,
  state: AdapterState,
): RedactionResult<string | undefined> {
  if (next === undefined) {
    return success(current, state);
  }
  if (typeof next !== "string") {
    return unsupportedShape(state, path);
  }
  if (current !== undefined && current !== next) {
    return unsupportedShape(state, path);
  }
  return success(next, state);
}

function appendStreamText(
  stream: OpenAICompatibleStreamState,
  current: string,
  chunk: string,
  path: string,
): RedactionResult<string> {
  if (current.length + chunk.length > stream.maxStreamBufferLength) {
    stream.adapter.warnings.push({
      code: "max_stream_buffer_length_exceeded",
      path,
    });
    return createFailure(
      stream.adapter,
      "max_stream_buffer_length_exceeded",
      "OpenAI-compatible stream exceeded the configured buffer length.",
    );
  }
  return success(current + chunk, stream.adapter);
}

function streamFailure<T>(
  code: SafeRedactionError["code"],
  message: string,
): RedactionResult<T> {
  const warnings: RedactionWarning[] = [{ code }];
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
    },
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

    if (
      !isOptionalInteger(clonedChoice.index) ||
      !isOptionalStringOrNull(clonedChoice.finish_reason)
    ) {
      return unsupportedShape(state, `$.choices[${index}]`);
    }

    if ("text" in clonedChoice) {
      if (typeof clonedChoice.text !== "string") {
        return unsupportedShape(state, `$.choices[${index}].text`);
      }
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

  if (!isOptionalString(message.role)) {
    return unsupportedShape(state, `${path}.role`);
  }

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
    if (
      !isOptionalInteger(clonedToolCall.index) ||
      !isOptionalString(clonedToolCall.id) ||
      !isOptionalString(clonedToolCall.type)
    ) {
      return unsupportedShape(state, `${path}[${index}]`);
    }
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

      if (!isOptionalString(fn.name)) {
        return unsupportedShape(state, `${path}[${index}].function.name`);
      }

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
      const result = await redactJsonToolArgumentsString(
        value,
        redactionForCurrentBudget(state),
      );
      if (!result.ok) {
        return failureFromResult(result, state);
      }
      recordCoreReport(state, result.report);
      return success(result.value, state);
    } catch (error) {
      if (error instanceof LosslessJsonToolArgumentsError) {
        state.warnings.push({ code: error.code, path });
        return createFailure(state, error.code, error.safeMessage);
      }
      if (error instanceof SyntaxError) {
        state.warnings.push({ code: "malformed_tool_arguments", path });
        return createFailure(
          state,
          "malformed_tool_arguments",
          "Malformed tool arguments could not be safely redacted.",
        );
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
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      return unsupportedShape(state, `${path}.{${index}}`);
    }

    if (!allowedKeys.has(key)) {
      return unsupportedShape(state, `${path}.{${index}}`);
    }
  }

  return success(undefined, state);
}

function validateRequestMetadata(
  record: MutableRecord,
  state: AdapterState,
): RedactionResult<void> {
  if (
    !isOptionalString(record.model) ||
    !isOptionalFiniteNumber(record.temperature) ||
    !isOptionalFiniteNumber(record.top_p) ||
    !isOptionalInteger(record.n) ||
    !isOptionalBoolean(record.stream) ||
    !isOptionalInteger(record.max_tokens) ||
    !isOptionalInteger(record.max_completion_tokens)
  ) {
    return unsupportedShape(state);
  }

  return success(undefined, state);
}

function validateResponseMetadata(
  record: MutableRecord,
  state: AdapterState,
): RedactionResult<void> {
  if (
    !isOptionalString(record.id) ||
    !isOptionalString(record.object) ||
    !isOptionalInteger(record.created) ||
    !isOptionalString(record.model) ||
    !isOptionalString(record.system_fingerprint)
  ) {
    return unsupportedShape(state);
  }

  return success(undefined, state);
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
