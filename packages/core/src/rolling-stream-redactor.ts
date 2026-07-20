import { resolveDetectors } from "./detector-policy.js";
import { createEmptyReport, createFailure } from "./report.js";
import { resolveRedactionOperationOptions } from "./redaction-profile.js";
import { redactText } from "./redact-text.js";
import type {
  BuiltInDetectorName,
  RedactionOptions,
  RedactionResult,
  RedactionWarning,
  SafeRedactionError,
} from "./types.js";

const DEFAULT_MAX_STREAM_BUFFER_LENGTH = 65_536;
const TRAILING_BEARER_CONTEXT = /(^|[^A-Za-z0-9_])(?:Bearer|Token|Basic)$/i;
const WHITESPACE = /\s/u;

export type BuiltInRollingTextStreamOptions = Omit<
  RedactionOptions,
  "builtInDetectors" | "detectors"
> & {
  builtInDetectors?: readonly BuiltInDetectorName[];
  detectors?: never;
};

export type RollingTextStreamChunk = {
  content: string;
  final: boolean;
  retainedCodeUnits: number;
};

export type RollingTextStreamRedactor = {
  push(chunk: string): Promise<RedactionResult<RollingTextStreamChunk>>;
  close(): Promise<RedactionResult<RollingTextStreamChunk>>;
};

type BudgetState = {
  totalStringCodeUnits: number;
  totalRedactions: number;
  detectorRuns: number;
  redactionDurationMs: number;
};

export function createBuiltInRollingTextStreamRedactor(
  inputOptions: BuiltInRollingTextStreamOptions = {},
): RollingTextStreamRedactor {
  const optionsResult = resolveRedactionOperationOptions(inputOptions);
  if (!optionsResult.ok) {
    return failedRollingStreamRedactor(optionsResult.error);
  }

  const options = optionsResult.value;
  if (
    options.detectors !== undefined ||
    options.builtInDetectors === false ||
    options.builtInDetectors?.length === 0
  ) {
    return failedRollingStreamRedactor({
      code: "invalid_redaction_options",
      message:
        "Rolling stream redaction requires at least one built-in detector and does not accept custom detectors or profiles.",
    });
  }

  const detectorsResult = resolveDetectors(options);
  if (!detectorsResult.ok) {
    return failedRollingStreamRedactor(detectorsResult.error);
  }
  const detectorCount = detectorsResult.value.length;
  const maxStreamBufferLength = Math.max(
    0,
    options.limits?.maxStreamBufferLength ?? DEFAULT_MAX_STREAM_BUFFER_LENGTH,
  );
  const budgets: BudgetState = {
    totalStringCodeUnits: 0,
    totalRedactions: 0,
    detectorRuns: 0,
    redactionDurationMs: 0,
  };
  let buffer = "";
  let failed: RedactionResult<never> | undefined;
  let closed = false;
  let operationInProgress = false;
  let generation = 0;

  const failTerminal = (
    code: SafeRedactionError["code"],
    message: string,
  ): RedactionResult<never> => {
    buffer = "";
    failed = streamFailure(code, message, [{ code }]);
    return failed;
  };

  const rejectConcurrentOperation = (): RedactionResult<never> => {
    generation += 1;
    return failTerminal(
      "stream_operation_in_progress",
      "Rolling stream redaction accepts only one awaited operation at a time.",
    );
  };

  const redactPrefix = async (
    prefix: string,
    suffix: string,
    final: boolean,
    operationGeneration: number,
  ): Promise<RedactionResult<RollingTextStreamChunk>> => {
    if (prefix.length === 0 && !final) {
      return retainedChunk(buffer.length);
    }

    const budgetFailure = checkBudgetBeforeDetectorRun(
      options,
      budgets,
      detectorCount,
    );
    if (budgetFailure) {
      return failTerminal(budgetFailure.code, budgetFailure.message);
    }

    const result = await redactText(
      prefix,
      optionsForRemainingBudgets(options, budgets),
    );
    if (generation !== operationGeneration || failed) {
      return failed ?? rejectConcurrentOperation();
    }
    if (!result.ok) {
      buffer = "";
      failed = result;
      return result;
    }

    budgets.totalRedactions += result.report.totalRedactions;
    budgets.detectorRuns += result.report.timings?.detectorRuns ?? 0;
    budgets.redactionDurationMs += result.report.timings?.durationMs ?? 0;
    buffer = suffix;
    return {
      ...result,
      value: {
        content: result.value,
        final,
        retainedCodeUnits: suffix.length,
      },
    };
  };

  return {
    async push(chunk) {
      if (failed) {
        return failed;
      }
      if (closed) {
        return streamFailure(
          "stream_closed",
          "Rolling stream redaction cannot accept chunks after close.",
          [{ code: "stream_closed" }],
        );
      }
      if (operationInProgress) {
        return rejectConcurrentOperation();
      }

      operationInProgress = true;
      const operationGeneration = generation;
      try {
        if (typeof chunk !== "string") {
          return failTerminal(
            "unsupported_provider_shape",
            "Rolling stream redaction chunks must be strings.",
          );
        }

        budgets.totalStringCodeUnits += chunk.length;
        const maxTotalStringLength = options.limits?.maxTotalStringLength;
        if (
          maxTotalStringLength !== undefined &&
          budgets.totalStringCodeUnits > maxTotalStringLength
        ) {
          return failTerminal(
            "max_total_string_length_exceeded",
            "Rolling stream redaction exceeded the configured total string length.",
          );
        }

        const chunkHasWhitespace = WHITESPACE.test(chunk);
        const candidateLength = buffer.length + chunk.length;
        if (!chunkHasWhitespace && candidateLength > maxStreamBufferLength) {
          return failTerminal(
            "max_stream_buffer_length_exceeded",
            "Rolling stream redaction exceeded the configured retained buffer length.",
          );
        }

        const candidateBuffer = buffer + chunk;
        const flushIndex = chunkHasWhitespace
          ? findBuiltInSafeFlushIndex(candidateBuffer)
          : 0;
        const retainedSuffix = candidateBuffer.slice(flushIndex);
        if (retainedSuffix.length > maxStreamBufferLength) {
          return failTerminal(
            "max_stream_buffer_length_exceeded",
            "Rolling stream redaction exceeded the configured retained buffer length.",
          );
        }
        buffer = candidateBuffer;

        return await redactPrefix(
          buffer.slice(0, flushIndex),
          retainedSuffix,
          false,
          operationGeneration,
        );
      } finally {
        if (generation === operationGeneration) {
          operationInProgress = false;
        }
      }
    },
    async close() {
      if (failed) {
        return failed;
      }
      if (closed) {
        return streamFailure(
          "stream_already_closed",
          "Rolling stream redaction has already been closed.",
          [{ code: "stream_already_closed" }],
        );
      }
      if (operationInProgress) {
        return rejectConcurrentOperation();
      }

      operationInProgress = true;
      const operationGeneration = generation;
      closed = true;
      try {
        return await redactPrefix(buffer, "", true, operationGeneration);
      } finally {
        if (generation === operationGeneration) {
          operationInProgress = false;
        }
      }
    },
  };
}

export function findBuiltInSafeFlushIndex(buffer: string): number {
  let lastWhitespace: RegExpExecArray | undefined;
  const whitespace = /\s+/g;
  for (
    let match = whitespace.exec(buffer);
    match;
    match = whitespace.exec(buffer)
  ) {
    lastWhitespace = match;
  }
  if (!lastWhitespace) {
    return 0;
  }

  const beforeWhitespace = buffer.slice(0, lastWhitespace.index);
  const bearerContext = TRAILING_BEARER_CONTEXT.exec(beforeWhitespace);
  if (bearerContext) {
    return bearerContext.index + (bearerContext[1]?.length ?? 0);
  }
  return lastWhitespace.index + lastWhitespace[0].length;
}

function checkBudgetBeforeDetectorRun(
  options: RedactionOptions,
  budgets: BudgetState,
  detectorCount: number,
): SafeRedactionError | undefined {
  const maxDetectorRuns = options.limits?.maxDetectorRuns;
  if (
    maxDetectorRuns !== undefined &&
    budgets.detectorRuns + detectorCount > maxDetectorRuns
  ) {
    return {
      code: "max_detector_runs_exceeded",
      message:
        "Rolling stream redaction exceeded the configured detector execution limit.",
    };
  }

  const maxTotalDurationMs = options.limits?.maxTotalDurationMs;
  if (
    maxTotalDurationMs !== undefined &&
    budgets.redactionDurationMs >= maxTotalDurationMs
  ) {
    return {
      code: "max_total_duration_exceeded",
      message:
        "Rolling stream redaction exceeded the configured total duration.",
    };
  }
  return undefined;
}

function optionsForRemainingBudgets(
  options: RedactionOptions,
  budgets: BudgetState,
): RedactionOptions {
  const limits = { ...options.limits };
  if (limits.maxTotalDetections !== undefined) {
    limits.maxTotalDetections = Math.max(
      0,
      limits.maxTotalDetections - budgets.totalRedactions,
    );
  }
  if (limits.maxTotalDurationMs !== undefined) {
    limits.maxTotalDurationMs = Math.max(
      0,
      limits.maxTotalDurationMs - budgets.redactionDurationMs,
    );
  }
  return { ...options, limits };
}

function failedRollingStreamRedactor(
  error: SafeRedactionError,
): RollingTextStreamRedactor {
  const warnings: RedactionWarning[] = [{ code: error.code }];
  const failure = createFailure<never>(error.code, error.message, warnings);
  return {
    async push() {
      return failure;
    },
    async close() {
      return failure;
    },
  };
}

function retainedChunk(
  retainedCodeUnits: number,
): RedactionResult<RollingTextStreamChunk> {
  return {
    ok: true,
    value: {
      content: "",
      final: false,
      retainedCodeUnits,
    },
    report: createEmptyReport(),
    warnings: [],
  };
}

function streamFailure<T>(
  code: SafeRedactionError["code"],
  message: string,
  warnings: RedactionWarning[],
): RedactionResult<T> {
  return createFailure(code, message, warnings);
}
