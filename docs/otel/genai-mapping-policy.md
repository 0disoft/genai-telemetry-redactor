# OpenTelemetry GenAI Mapping Policy

Status: Product-shaping

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

## Review Blockers

- Mapper APIs accept raw provider payloads.
- Mapping changes lack version notes.
- Redaction reports include original values, reversible encodings, or sensitive
  field paths by default.
