import {
  createRedactionProfile,
  withRedactedTelemetry,
} from "genai-telemetry-redactor";

const profileResult = createRedactionProfile({
  builtInDetectors: ["email", "url"],
  limits: {
    maxDetectors: 2,
    maxDetectorRuns: 16,
    maxTotalDurationMs: 1_000,
  },
});

if (!profileResult.ok) {
  throw new Error(`profile creation failed: ${profileResult.error.code}`);
}

const result = await withRedactedTelemetry({
  adapter: "openai-compatible",
  request: {
    messages: [
      {
        role: "user",
        content:
          "Contact user@example.invalid about https://example.invalid/case",
      },
    ],
  },
  redaction: { profile: profileResult.value },
  telemetry: {
    operationName: "chat",
    providerName: "openai-compatible",
  },
});

if (!result.ok) {
  throw new Error(`SDK profile redaction failed: ${result.error.code}`);
}

const serialized = JSON.stringify(result.value);
if (
  serialized.includes("user@example.invalid") ||
  serialized.includes("https://example.invalid/case")
) {
  throw new Error("SDK profile example leaked unsafe content");
}

if (result.value.report.totalRedactions !== 2) {
  throw new Error("SDK profile example expected two redactions");
}

export const redactedRequest = result.value.redactedRequest;
export const telemetry = result.value.telemetry;
