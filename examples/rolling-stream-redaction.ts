import { createBuiltInRollingTextStreamRedactor } from "genai-telemetry-redactor";

const stream = createBuiltInRollingTextStreamRedactor({
  builtInDetectors: ["email", "bearer_token"],
  limits: {
    maxStreamBufferLength: 128,
    maxTotalStringLength: 1_024,
  },
});

const output: string[] = [];
for (const chunk of [
  "Contact user@exam",
  "ple.invalid before export. Bearer ",
  "example_token_value ",
]) {
  const result = await stream.push(chunk);
  if (!result.ok) {
    throw new Error(`rolling stream failed: ${result.error.code}`);
  }
  output.push(result.value.content);
}

const final = await stream.close();
if (!final.ok) {
  throw new Error(`rolling stream close failed: ${final.error.code}`);
}
output.push(final.value.content);

const combined = output.join("");
if (
  combined.includes("user@example.invalid") ||
  combined.includes("example_token_value")
) {
  throw new Error("rolling stream example leaked unsafe content");
}

export const rollingStreamOutput = combined;
export const rollingStreamFinalReport = final.report;
