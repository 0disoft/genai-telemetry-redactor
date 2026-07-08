import { createEmptyReport, createFailure } from "./report.js";
import { redactText } from "./redact-text.js";
import type {
  RedactionOptions,
  RedactionResult,
  RedactionWarning,
  SafeRedactionError,
} from "./types.js";

const DEFAULT_MAX_STREAM_BUFFER_LENGTH = 65_536;

export type BufferedTextStreamChunk = {
  content: "";
  contentOmitted: true;
  warningCode: "streaming_content_omitted";
};

export type BufferedTextStreamRedactor = {
  push(chunk: string): RedactionResult<BufferedTextStreamChunk>;
  close(): Promise<RedactionResult<string>>;
};

export function createBufferedTextStreamRedactor(
  options: RedactionOptions = {},
): BufferedTextStreamRedactor {
  const maxStreamBufferLength =
    options.limits?.maxStreamBufferLength ?? DEFAULT_MAX_STREAM_BUFFER_LENGTH;
  const normalizedMaxStreamBufferLength = Math.max(0, maxStreamBufferLength);
  let buffer = "";
  let failed: RedactionResult<never> | undefined;
  let closed = false;

  return {
    push(chunk) {
      if (failed) {
        return failed;
      }

      if (closed) {
        failed = streamFailure(
          "unsupported_provider_shape",
          "Streaming redaction cannot accept chunks after close.",
          [{ code: "unsupported_provider_shape" }],
        );
        return failed;
      }

      if (typeof chunk !== "string") {
        failed = streamFailure(
          "unsupported_provider_shape",
          "Streaming redaction chunks must be strings.",
          [{ code: "unsupported_provider_shape" }],
        );
        return failed;
      }

      if (buffer.length + chunk.length > normalizedMaxStreamBufferLength) {
        buffer = "";
        failed = streamFailure(
          "max_stream_buffer_length_exceeded",
          "Streaming redaction exceeded the configured buffer length.",
          [{ code: "max_stream_buffer_length_exceeded" }],
        );
        return failed;
      }

      buffer += chunk;
      return omittedChunk();
    },
    async close() {
      if (failed) {
        return failed;
      }

      if (closed) {
        return streamFailure(
          "unsupported_provider_shape",
          "Streaming redaction has already been closed.",
          [{ code: "unsupported_provider_shape" }],
        );
      }

      closed = true;
      const input = buffer;
      buffer = "";
      return redactText(input, options);
    },
  };
}

function omittedChunk(): RedactionResult<BufferedTextStreamChunk> {
  const warnings: RedactionWarning[] = [{ code: "streaming_content_omitted" }];
  return {
    ok: true,
    value: {
      content: "",
      contentOmitted: true,
      warningCode: "streaming_content_omitted",
    },
    report: createEmptyReport(warnings),
    warnings,
  };
}

function streamFailure<T>(
  code: SafeRedactionError["code"],
  message: string,
  warnings: RedactionWarning[],
): RedactionResult<T> {
  return createFailure(code, message, warnings);
}
