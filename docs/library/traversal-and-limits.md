# Traversal and Limits

Status: Product-shaping

## Contract

Traversal must redact nested JSON-like data without creating a denial-of-service
path or leaking raw tool arguments.

## Implemented Limits

- Maximum string length: configurable through `maxStringLength`.
- Maximum object depth: configurable through `maxObjectDepth`.
- Maximum key count: configurable through `maxObjectKeys`.
- Maximum array length: configurable through `maxArrayLength`.
- Circular reference behavior: fail closed with `circular_reference`.

Malformed JSON string parsing is not implemented yet; callers can pass parsed
tool argument objects or strings for text redaction.

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
