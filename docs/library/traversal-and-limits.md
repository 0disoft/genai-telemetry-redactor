# Traversal and Limits

Status: Product-shaping

## Contract

Traversal must redact nested JSON-like data without creating a denial-of-service
path or leaking raw tool arguments.

## Required Decisions Before Implementation

- Maximum string length.
- Maximum object depth.
- Maximum key count.
- Maximum array length.
- Circular reference behavior.
- How malformed JSON tool arguments are represented.

## Safety Rules

- Preserve object shape when safe so callers can debug redaction location.
- Do not export full field paths in telemetry by default; paths can reveal
  business domain information.
- If traversal limits are exceeded, fail closed for content export and emit safe
  warnings.

## Review Blockers

- Limit failures return partially redacted content as safe.
- Telemetry summaries include sensitive field paths by default.
- Traversal flattens nested tool arguments without documented tradeoffs.
