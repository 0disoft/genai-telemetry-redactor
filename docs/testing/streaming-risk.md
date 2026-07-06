# Streaming Risk

Status: Active

## Contract

Streaming content export is unsafe for the MVP because sensitive values can be
split across chunk boundaries. Until streaming redaction has a tested buffering
policy, streaming telemetry must be metadata-only.

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

## Review Blockers

- Streaming chunks are redacted independently without boundary tests.
- A streaming example includes raw content in telemetry.
- The SDK hides streaming omission warnings from callers.
