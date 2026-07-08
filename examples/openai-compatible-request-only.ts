import { withRedactedTelemetry } from "genai-telemetry-redactor";

const result = await withRedactedTelemetry({
  adapter: "openai-compatible",
  request: {
    model: "model_example",
    prompt: "Contact user@example.invalid with key_example_value",
  },
  redaction: {
    limits: {
      maxDetectors: 4,
      maxTotalDurationMs: 1_000,
    },
  },
  telemetry: {
    operationName: "completion",
    providerName: "openai-compatible",
    requestModel: "model_example",
  },
});

if (!result.ok) {
  throw new Error(`request-only example failed: ${result.error.code}`);
}

const output = JSON.stringify(result.value);
for (const unsafeValue of ["user@example.invalid", "key_example_value"]) {
  if (output.includes(unsafeValue)) {
    throw new Error(`request-only example leaked unsafe value: ${unsafeValue}`);
  }
}

if ("redactedResponse" in result.value) {
  throw new Error("request-only example should not return a response payload");
}

if (result.value.report.totalRedactions !== 2) {
  throw new Error("request-only example expected two redactions");
}

export const redactedRequestOnlyPayload = result.value.redactedRequest;
export const requestOnlyTelemetry = result.value.telemetry;
