import { redactAnthropicMessagesRequest } from "genai-telemetry-redactor/anthropic-messages";

const result = await redactAnthropicMessagesRequest({
  model: "model_example",
  max_tokens: 128,
  system: "Route account questions to system@example.invalid",
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Look up user@example.invalid",
        },
      ],
    },
  ],
});

if (!result.ok) {
  throw new Error(result.error.code);
}

if (JSON.stringify(result.value).includes("@example.invalid")) {
  throw new Error("Anthropic Messages example redaction failed");
}

console.log(result.report.status, result.report.totalRedactions);
