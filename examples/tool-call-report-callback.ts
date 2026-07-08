import { withRedactedTelemetry } from "genai-telemetry-redactor";

const callbackReports: string[] = [];
const toolArguments = JSON.stringify({
  email: "user@example.invalid",
  endpoint: "https://example.invalid/profile",
});

const result = await withRedactedTelemetry({
  adapter: "openai-compatible",
  request: {
    model: "model_example",
    messages: [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_example",
            type: "function",
            function: {
              name: "lookup_profile",
              arguments: toolArguments,
            },
          },
        ],
      },
    ],
  },
  redaction: {
    limits: {
      maxDetectors: 4,
      maxDetectorRuns: 64,
      maxTotalDurationMs: 1_000,
    },
  },
  reportContext: {
    operationId: "chat:tool-call-example",
    attemptId: "attempt-1",
    idempotencyKey: "tool-call-example-1",
  },
  onReport(report, telemetry, context) {
    callbackReports.push(
      JSON.stringify({
        status: report.status,
        totalRedactions: report.totalRedactions,
        warningCodes:
          telemetry.attributes["genai_redactor.redaction.warning_codes"],
        idempotencyKey: context.idempotencyKey,
      }),
    );
  },
});

if (!result.ok) {
  throw new Error(`tool-call example failed: ${result.error.code}`);
}

const output = JSON.stringify(result.value);
for (const unsafeValue of [
  "user@example.invalid",
  "https://example.invalid/profile",
]) {
  if (output.includes(unsafeValue)) {
    throw new Error(`tool-call example leaked unsafe value: ${unsafeValue}`);
  }
}

if (callbackReports.length !== 1) {
  throw new Error("tool-call example expected one report callback");
}

if (!callbackReports[0]?.includes("tool-call-example-1")) {
  throw new Error("tool-call example did not preserve safe report context");
}

export const redactedToolCallRequest = result.value.redactedRequest;
export const toolCallReport = result.value.report;
export const toolCallCallbackReport = callbackReports[0];
