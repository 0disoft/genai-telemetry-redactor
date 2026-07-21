export const PINNED_OTEL_GENAI_SEMCONV = {
  repository: "https://github.com/open-telemetry/semantic-conventions-genai",
  commit: "150760c6252a4bb63c49c9915bad11997d316a15",
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
