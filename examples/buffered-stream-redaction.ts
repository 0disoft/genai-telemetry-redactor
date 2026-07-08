import { createBufferedTextStreamRedactor } from "genai-telemetry-redactor";

const stream = createBufferedTextStreamRedactor({
  limits: {
    maxStreamBufferLength: 128,
    maxTotalDurationMs: 1_000,
  },
});

const first = stream.push("Contact user@exam");
const second = stream.push("ple.invalid before export");
const result = await stream.close();

if (!first.ok || !second.ok) {
  throw new Error("buffered stream example should omit intermediate content");
}

if (first.value.content !== "" || second.value.content !== "") {
  throw new Error("buffered stream example returned intermediate content");
}

if (!result.ok) {
  throw new Error(`buffered stream example failed: ${result.error.code}`);
}

if (result.value.includes("user@example.invalid")) {
  throw new Error("buffered stream example leaked a split unsafe value");
}

if (!result.value.includes("[REDACTED:email]")) {
  throw new Error("buffered stream example did not redact split email content");
}

export const bufferedStreamOutput = result.value;
export const bufferedStreamReport = result.report;
