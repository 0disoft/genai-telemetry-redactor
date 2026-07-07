import { redactOpenAICompatibleStreamEvent } from "genai-telemetry-redactor";

const result = redactOpenAICompatibleStreamEvent({
  choices: [
    {
      delta: {
        content:
          "Partial chunk for user@example.invalid with token_example_value",
      },
    },
  ],
});

if (!result.ok) {
  throw new Error(`streaming example failed: ${result.error.code}`);
}

const metadataOnlyPayload = JSON.stringify(result.value);

for (const unsafeValue of ["user@example.invalid", "token_example_value"]) {
  if (metadataOnlyPayload.includes(unsafeValue)) {
    throw new Error(`streaming example leaked unsafe value: ${unsafeValue}`);
  }
}

if (!result.value.contentOmitted) {
  throw new Error("streaming example must omit content");
}

if (
  !result.report.warnings.some(
    (warning) => warning.code === "streaming_content_omitted",
  )
) {
  throw new Error("streaming example must report omitted content");
}

export const streamMetadata = result.value;
export const streamReport = result.report;
