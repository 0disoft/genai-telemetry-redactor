# OpenTelemetry GenAI Mapping Policy

Status: Implementation-started

## Contract

OpenTelemetry mapping receives safe metadata and redaction summaries. It must not
receive raw prompts, completions, tool arguments, credentials, private URLs, or
customer identifiers.

## Mapping Rules

- Keep the exact GenAI semantic-convention version UNDECIDED until implementation
  verifies the current upstream convention state.
- Include a mapper version label or convention label once chosen.
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
- The mapper always emits `gen_ai.telemetry.content_capture_enabled: false`.
- The mapper emits redaction status, total count, built-in reason counts,
  aggregated custom reason counts, warning codes, safe model/provider/operation
  labels, token usage, latency, and error class.
- Warning `path` and `detectorId` fields are not exported by default.
- Exact upstream GenAI semantic-convention version remains `UNDECIDED`; this mapper
  exposes a convention label field without claiming a verified upstream version.

## Review Blockers

- Mapper APIs accept raw provider payloads.
- Mapping changes lack version notes.
- Redaction reports include original values, reversible encodings, or sensitive
  field paths by default.
