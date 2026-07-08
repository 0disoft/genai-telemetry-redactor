# Streaming Content Policy

Status: Accepted

## Context

Streaming chunks can split sensitive values across chunk boundaries. A detector
that sees one chunk at a time can miss values that are obvious only after
joining adjacent chunks.

## Decision

MVP streaming telemetry is metadata-only. Streaming content export remains
blocked until a rolling-buffer policy, chunk-boundary fixtures, and fail-closed
behavior are implemented and reviewed.

`createBufferedTextStreamRedactor` is the first provider-agnostic buffered
prototype. It is explicit opt-in and final-flush only. OpenAI-compatible
streaming adapters still return metadata-only `streaming_content_omitted`
results by default.

## Consequences

- Initial streaming observability has less content detail.
- The SDK must surface warnings when streaming content is omitted.
- Low-latency streaming redaction still requires a future ADR update or
  replacement.
