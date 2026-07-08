# Streaming Risk

Status: Active

## Contract

Streaming content export is unsafe by default because sensitive values can be
split across chunk boundaries. OpenAI-compatible streaming telemetry remains
metadata-only unless a caller explicitly uses a reviewed buffered redaction
helper.

## Required Evidence Before Content Export

- Rolling buffer policy.
- Chunk-boundary fixtures where secrets are split across chunks.
- Maximum buffer and latency behavior.
- Fail-closed behavior when chunks exceed limits.
- Warnings that tell callers content was omitted.

## MVP Behavior

- Emit safe stream metadata only.
- Emit `streaming_content_omitted` or equivalent warning.
- Do not export raw chunks.

## Explicit Buffered Prototype

`createBufferedTextStreamRedactor` is provider-agnostic and final-flush only.
`push(chunk)` omits content and reports `streaming_content_omitted`; `close()`
redacts the full buffered text. Buffer overflow fails closed with
`max_stream_buffer_length_exceeded` and detector failure returns no partial
content.

## Review Blockers

- Streaming chunks are redacted independently without boundary tests.
- A streaming example includes raw content in telemetry.
- The SDK hides streaming omission warnings from callers.
