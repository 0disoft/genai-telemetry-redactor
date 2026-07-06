import {
  redactJsonLike,
  redactText,
  redactToolArguments,
  type RedactionReport,
  type RedactionResult,
  type SafeRedactionError,
  type RedactionWarning,
} from "../../core/src/index.js";
import type {
  OpenAICompatibleOptions,
  OpenAICompatibleStreamRedactionMetadata,
} from "./types.js";

type MutableRecord = Record<string, unknown>;

type AdapterState = {
  options: OpenAICompatibleOptions;
  reports: RedactionReport[];
  warnings: RedactionWarning[];
};

export async function redactOpenAICompatibleRequest<T>(
  input: T,
  options: OpenAICompatibleOptions = {},
): Promise<RedactionResult<T>> {
  const state = createAdapterState(options);

  if (!isRecord(input)) {
    return unsupportedShape(state);
  }

  const cloned = cloneRecord(input);
  const redactResult = await redactRequestRecord(cloned, state);
  if (!redactResult.ok) {
    return redactResult;
  }

  return success(cloned as T, state);
}

export async function redactOpenAICompatibleResponse<T>(
  input: T,
  options: OpenAICompatibleOptions = {},
): Promise<RedactionResult<T>> {
  const state = createAdapterState(options);

  if (!isRecord(input)) {
    return unsupportedShape(state);
  }

  const cloned = cloneRecord(input);
  const redactResult = await redactResponseRecord(cloned, state);
  if (!redactResult.ok) {
    return redactResult;
  }

  return success(cloned as T, state);
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
  return success(record, state);
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

      const result = await redactJsonLike(part, state.options);
      if (!result.ok) {
        return result;
      }
      state.reports.push(result.report);
      parts.push(result.value);
    }
    return success(parts, state);
  }

  if (value == null) {
    return success(value, state);
  }

  if (isRecord(value)) {
    const result = await redactJsonLike(value, state.options);
    if (!result.ok) {
      return result;
    }
    state.reports.push(result.report);
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

    const clonedToolCall = cloneRecord(toolCall);
    if ("function" in clonedToolCall && !isRecord(clonedToolCall.function)) {
      return unsupportedShape(state, `${path}[${index}].function`);
    }

    if (isRecord(clonedToolCall.function)) {
      const fn = cloneRecord(clonedToolCall.function);

      if (state.options.redactToolNames && typeof fn.name === "string") {
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
      const result = await redactToolArguments(parsed, state.options);
      if (!result.ok) {
        return result;
      }
      state.reports.push(result.report);
      return success(JSON.stringify(result.value), state);
    } catch (error) {
      if (error instanceof SyntaxError) {
        state.warnings.push({ code: "malformed_tool_arguments", path });
        return redactStringValue(value, state);
      }
      throw error;
    }
  }

  const result = await redactToolArguments(value, state.options);
  if (!result.ok) {
    return result;
  }
  state.reports.push(result.report);
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
    const result = await redactJsonLike(value, state.options);
    if (!result.ok) {
      return result;
    }
    state.reports.push(result.report);
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

  const result = await redactText(value, state.options);
  if (!result.ok) {
    return result;
  }

  state.reports.push(result.report);
  return success(result.value, state);
}

function createAdapterState(options: OpenAICompatibleOptions): AdapterState {
  return {
    options,
    reports: [],
    warnings: [],
  };
}

function success<T>(value: T, state: AdapterState): RedactionResult<T> {
  const report = mergeReports([
    ...state.reports,
    {
      status: "unchanged",
      totalRedactions: 0,
      countsByReason: {},
      warnings: state.warnings,
    },
  ]);
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
    "unsupported_provider_shape",
    "Unsupported OpenAI-compatible shape; content-bearing fields were not exported.",
    state.warnings,
  );
}

function isRecord(value: unknown): value is MutableRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneRecord<T extends MutableRecord>(value: T): MutableRecord {
  return { ...value };
}

function createFailure<T>(
  code: SafeRedactionError["code"],
  message: string,
  warnings: RedactionWarning[],
): RedactionResult<T> {
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

function mergeReports(reports: readonly RedactionReport[]): RedactionReport {
  const countsByReason: Record<string, number> = {};
  const warnings: RedactionWarning[] = [];
  let totalRedactions = 0;
  let failed = false;

  for (const report of reports) {
    if (report.status === "failed") {
      failed = true;
    }

    totalRedactions += report.totalRedactions;
    warnings.push(...report.warnings);

    for (const [reason, count] of Object.entries(report.countsByReason)) {
      countsByReason[reason] = (countsByReason[reason] ?? 0) + count;
    }
  }

  return {
    status: failed ? "failed" : totalRedactions > 0 ? "redacted" : "unchanged",
    totalRedactions,
    countsByReason,
    warnings,
  };
}
