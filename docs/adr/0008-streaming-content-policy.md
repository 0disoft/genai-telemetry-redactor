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

`createBuiltInRollingTextStreamRedactor` is the first lower-latency core helper.
It flushes only proven whitespace-delimited prefixes, retains bearer-scheme
context, rejects custom detectors and profiles, and fails closed on retained
buffer overflow or overlapping async operations. Provider adapters and the SDK
remain metadata-only; the core proof does not establish provider event-shape or
cancellation safety.

## Consequences

- Initial streaming observability has less content detail.
- The SDK must surface warnings when streaming content is omitted.
- Low-latency custom-detector and provider-adapter streaming still requires a
  separate proof. ADR 0017 covers only the reviewed built-in core boundary.
