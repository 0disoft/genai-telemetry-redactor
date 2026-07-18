export const PINNED_OTEL_GENAI_SEMCONV = {
  repository: "https://github.com/open-telemetry/semantic-conventions-genai",
  commit: "c26a2c21d1ee70d5231bd440c7b48d3c94ee506a",
  status: "development",
  mappedAttributes: {
    "gen_ai.operation.name": "string",
    "gen_ai.provider.name": "string",
    "gen_ai.request.model": "string",
    "gen_ai.response.model": "string",
    "gen_ai.usage.input_tokens": "int",
    "gen_ai.usage.output_tokens": "int",
  },
} as const;
