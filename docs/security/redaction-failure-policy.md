# Redaction Failure Policy

Status: Active

## Contract

Any failure before telemetry export must fail closed for content-bearing fields.
Safe metadata may still be emitted when it does not include raw content.

## Failure Cases

- Operation policy contains unknown keys, malformed limits, a non-function
  replacement policy, or an invalid abort signal.
- Detector throws or times out.
- Custom detector returns invalid ranges.
- Traversal hits depth, key, array, or string limits.
- Serialization fails.
- Provider shape is unsupported.
- Provider shape or adapter option inspection throws.
- Streaming chunk redaction is not proven.
- OTel mapping fails after redaction begins.

## Required Behavior

- Omit content-bearing telemetry.
- Return `invalid_redaction_options` for malformed operation policy instead of
  ignoring it or silently applying default policy.
- Return or emit safe warning/error codes.
- Do not echo original exception messages when they may include raw input.
- Preserve enough metadata for diagnosis without raw content.

## Review Blockers

- A failure path exports partially redacted content.
- A safe error includes raw input, detector match values, provider payloads, or
  live-looking secrets.
- A custom detector failure is ignored while content export continues.
