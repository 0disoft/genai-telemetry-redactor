import { withRedactedTelemetry } from "genai-telemetry-redactor";

const result = await withRedactedTelemetry({
  adapter: "openai-compatible",
  request: {
    model: "model_example",
    messages: [
      {
        role: "user",
        content:
          "Contact user@example.invalid before calling https://internal.example.invalid/path",
      },
    ],
  },
  response: {
    choices: [
      {
        message: {
          role: "assistant",
          content: "The lookup used token_example_value.",
        },
      },
    ],
  },
  telemetry: {
    operationName: "chat",
    providerName: "openai",
    requestModel: "model_example",
    responseModel: "model_example",
    tokenUsage: {
      inputTokens: 21,
      outputTokens: 8,
      totalTokens: 29,
    },
  },
  redaction: {
    limits: {
      maxDetectors: 4,
      maxDetectorRuns: 64,
      maxTotalDurationMs: 1_000,
    },
  },
});

if (!result.ok) {
  throw new Error(`redaction failed: ${result.error.code}`);
}

const redactedPayload = JSON.stringify({
  request: result.value.redactedRequest,
  response: result.value.redactedResponse,
});

for (const unsafeValue of [
  "user@example.invalid",
  "https://internal.example.invalid/path",
  "token_example_value",
]) {
  if (redactedPayload.includes(unsafeValue)) {
    throw new Error(`example leaked unsafe value: ${unsafeValue}`);
  }
}

if (result.value.report.totalRedactions !== 3) {
  throw new Error(
    `expected 3 redactions, got ${result.value.report.totalRedactions}`,
  );
}

if (typeof result.value.report.timings?.durationMs !== "number") {
  throw new Error(
    "request/response example must expose safe redaction timings",
  );
}

if (
  result.value.telemetry.attributes[
    "genai_redactor.content_capture.enabled"
  ] !== false
) {
  throw new Error("content capture must remain disabled by default");
}

export const redactedRequest = result.value.redactedRequest;
export const redactedResponse = result.value.redactedResponse;
export const telemetry = result.value.telemetry;
