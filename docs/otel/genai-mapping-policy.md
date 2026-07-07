# OpenTelemetry GenAI Mapping Policy

Status: Active

## Contract

OpenTelemetry mapping receives safe metadata and redaction summaries. It must not
receive raw prompts, completions, tool arguments, credentials, private URLs, or
customer identifiers.

## Mapping Rules

- Treat the upstream OpenTelemetry GenAI semantic conventions as Development until
  the upstream project marks them stable.
- Use official `gen_ai.*` attributes only for fields present in the upstream GenAI
  semantic conventions.
- Put library-specific redaction and content-capture fields under
  `genai_redactor.*` so custom fields do not look like standard OpenTelemetry
  attributes.
- Separate pure metadata-object mapping from optional span-writer helpers.
- Treat token usage, model, operation, latency, error class, redaction status,
  and counts-by-reason as safe candidate fields.

## Implemented Mapper

- `mapRedactionReportToGenAIMetadata(report, options)` is a pure object mapper. It
  does not import OpenTelemetry SDK packages, write spans, write events, or export
  telemetry.
- The mapper accepts `RedactionReport` plus safe metadata candidates only. It does
  not accept provider requests, provider responses, prompts, completions, tool
  arguments, credentials, private URLs, customer identifiers, span objects, or
  exporter objects.
- The mapper uses official GenAI attributes for `gen_ai.operation.name`,
  `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.response.model`,
  `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, and
  `gen_ai.usage.total_tokens`.
- The mapper uses `genai_redactor.*` attributes for redaction status, redaction
  counts, warning codes, content-capture disabled state, mapper semconv source,
  mapper semconv status, and latency.
- Warning `path` and `detectorId` fields are not exported by default.
- The mapper records `opentelemetry-semconv-genai-main` and `development` as
  semconv metadata. This is not a stability claim.

## Review Blockers

- Mapper APIs accept raw provider payloads.
- Mapping changes lack version notes.
- Redaction reports include original values, reversible encodings, or sensitive
  field paths by default.
