# Buffered Stream Redaction Policy

Status: Accepted

## Context

Streaming GenAI responses can split sensitive values across chunk boundaries. A
chunk-by-chunk detector can miss `user@example.invalid` when one chunk contains
`user@exam` and the next contains `ple.invalid`.

The first streaming-safe implementation must avoid returning unredacted partial
content before enough context is available. Low-latency streaming flushes need a
separate proof that the trailing holdback window is large enough for every
supported detector and custom detector policy.

## Decision

Keep OpenAI-compatible streaming adapters metadata-only by default.

Add a provider-agnostic core prototype named
`createBufferedTextStreamRedactor(options)`. It accepts string chunks, buffers
them, returns omitted-content metadata from `push(chunk)`, and returns redacted
content only from `close()`.

The initial flush policy is final-only:

- `push(chunk)` never returns chunk content.
- `close()` redacts the complete buffered text with `redactText`.
- `maxStreamBufferLength` bounds buffered UTF-16 code units.
- Buffer overflow fails closed with `max_stream_buffer_length_exceeded`.
- Detector failure during `close()` fails closed and returns no partial content.
- `push()` after close fails with `stream_closed` without changing the terminal
  closed state.
- Repeated `close()` calls fail with `stream_already_closed`.

The prototype is intentionally not wired into
`redactOpenAICompatibleStreamEvent`. Provider adapters continue to emit
metadata-only `streaming_content_omitted` results until adapter-specific stream
shape fixtures and safe flush semantics are reviewed.

## Consequences

- Security impact: split secrets can be redacted at final flush without leaking
  earlier chunks.
- Compatibility impact: `createBufferedTextStreamRedactor`,
  `BufferedTextStreamChunk`, `BufferedTextStreamRedactor`,
  `RedactionLimits.maxStreamBufferLength`, and
  `max_stream_buffer_length_exceeded`, `stream_closed`, and
  `stream_already_closed` become public contracts.
- False-negative or false-positive impact: final redaction uses the same detector
  behavior as `redactText`.
- Telemetry semantics impact: default streaming telemetry remains metadata-only;
  explicit buffered stream redaction reports final aggregate redaction results.
- Migration impact: existing callers are unchanged unless they opt in to the new
  core helper.

## Source of Truth

- Product scope: `docs/product/02-spec.md`
- Public API: `docs/library/public-api.md`
- Adapter policy: `docs/adapters/openai-compatible-shape.md`
- Streaming risk: `docs/testing/streaming-risk.md`
- Validation evidence: `packages/core/test/buffered-stream-redactor.test.ts`

## Review Blockers

- A streaming helper returns chunk content from `push(chunk)` before final
  redaction.
- Buffer overflow returns partial buffered content.
- Detector failure returns partial buffered content.
- OpenAI-compatible streaming adapters export content by default.
- Low-latency flush behavior is added without boundary-split fixtures and a
  documented holdback policy.
