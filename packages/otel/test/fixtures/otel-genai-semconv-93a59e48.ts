export const PINNED_OTEL_GENAI_SEMCONV = {
  repository: "https://github.com/open-telemetry/semantic-conventions-genai",
  commit: "93a59e48a9b4ea162a4d76edac4ace2d415a759e",
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
