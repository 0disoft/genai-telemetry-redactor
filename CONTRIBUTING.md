# Contributing

Status: Active

## Project Boundary

Contributions should improve the GenAI telemetry redaction library and SDK
middleware surface. Good changes make it harder for applications to leak raw
prompt, completion, or tool argument content into telemetry while preserving
safe OpenTelemetry GenAI metadata.

## Source of Truth

- Product scope: docs/product/02-spec.md
- Library API: docs/library/public-api.md
- SDK API: docs/sdk/public-api.md
- Security baseline: docs/engineering/04-security-baseline.md
- Validation names: VALIDATION.md

## Contribution Rules

- Use fake examples only. Do not add live-looking tokens, API keys, private
  URLs, customer identifiers, prompts, completions, or tool arguments.
- Keep `capture_content: false` as the default unless a future ADR changes the
  product boundary.
- Do not claim complete DLP, PII, or compliance coverage.
- Add fixture evidence when detector behavior, replacement tokens, provider
  shape support, or telemetry mapping changes.
- Treat OpenAPI, DBML, migration, and backend service files as placeholders
  unless an ADR makes them active product surfaces.

## Review Blockers

- Raw sensitive content appears in docs, examples, fixtures, logs, errors, or
  telemetry samples.
- Public API behavior changes without migration notes.
- Detector default changes lack tests.
- A change expands the project into a telemetry backend, model gateway, prompt
  store, hosted API, or database without a product decision.
