# Redaction Failure Policy

Status: Active

## Contract

Any failure before telemetry export must fail closed for content-bearing fields.
Safe metadata may still be emitted when it does not include raw content.

## Failure Cases

- Detector throws or times out.
- Custom detector returns invalid ranges.
- Traversal hits depth, key, array, or string limits.
- Serialization fails.
- Provider shape is unsupported.
- Streaming chunk redaction is not proven.
- OTel mapping fails after redaction begins.

## Required Behavior

- Omit content-bearing telemetry.
- Return or emit safe warning/error codes.
- Do not echo original exception messages when they may include raw input.
- Preserve enough metadata for diagnosis without raw content.

## Review Blockers

- A failure path exports partially redacted content.
- A safe error includes raw input, detector match values, provider payloads, or
  live-looking secrets.
- A custom detector failure is ignored while content export continues.
