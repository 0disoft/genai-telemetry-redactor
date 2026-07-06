# Domain Model

Status: Active

## Concepts

- GenAI operation: a model request, response, tool call, or stream event handled
  by caller-owned code.
- Content field: prompt, completion, message content, tool argument, or related
  body text that may contain sensitive values.
- Detector: a rule or hook that finds a sensitive value class such as email,
  bearer token, API-key-like string, URL, or custom identifier.
- Redaction: replacement of detected content with a safe token.
- Redaction summary: counts and reason labels that can be exported without raw
  sensitive content.
- Telemetry mapping: OpenTelemetry GenAI metadata emitted after redaction.

## Data Ownership

The library never owns raw prompts, completions, tool arguments, credentials, or
customer identifiers. Callers own their data and pass it through the package for
in-memory redaction before telemetry export.

## Invariants

- `capture_content` defaults to false.
- Redaction must run before any content-bearing telemetry export.
- Detector misses are possible and must not be described as compliance proof.
- Replacement tokens must be useful for debugging counts and categories without
  preserving the original secret.
