# Logging and Observability

Status: Product-shaping

## Backend Contract

This repository does not currently own a hosted backend API. For this project,
logging and observability means the library contract for safe telemetry emission.

The core rule is simple: raw prompts, completions, tool arguments, API keys, bearer
tokens, customer identifiers, and private URLs must not be logged or exported by
default. Safe telemetry is metadata-first and content capture is opt-in after
redaction.

## Required Decisions

- API owner: not applicable until a hosted adapter exists.
- Auth model: not applicable for the library core.
- Authorization checks: callers own authorization before invoking the library.
- Persistence model: no raw-content persistence.
- Error response policy: library errors and warnings must never include raw sensitive
  values.
- Telemetry mapping: OpenTelemetry GenAI metadata helpers must emit redaction summaries
  without raw content.
- Streaming mapping: provider stream events remain metadata-only by default.
  Explicit rolling core output may be exported only after a successful built-in
  whitespace-boundary result; retained suffixes and failures are never telemetry.

## Merge Blockers

- A log, span, event, warning, or error includes unredacted prompt, completion, tool
  argument, token, URL, or customer text.
- Content capture is enabled by default.
- Redaction failure exports raw content instead of suppressing content fields.
- Redaction summary fields reveal enough context to reconstruct the original value.
- A guessed fixed holdback or provider chunk boundary is treated as proof that
  rolling content is safe.
