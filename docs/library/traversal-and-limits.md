# Traversal and Limits

Status: Product-shaping

## Contract

Traversal must redact nested plain JSON-like data without creating a
denial-of-service path or leaking raw tool arguments. Supported values are
primitives, arrays, plain objects, and `null`; provider SDK instances, `Date`,
`Map`, `Set`, `URL`, class instances, and other non-plain objects fail closed
instead of being coerced into `{}`.

## Implemented Limits

- Maximum string length: configurable through `maxStringLength`.
- Maximum total string length per JSON-like traversal: configurable through
  `maxTotalStringLength`.
- Maximum object depth: configurable through `maxObjectDepth`.
- Maximum key count: configurable through `maxObjectKeys`.
- Maximum array length: configurable through `maxArrayLength`.
- Maximum total node count per JSON-like traversal: configurable through
  `maxTotalNodes`.
- Maximum total redaction count per operation: configurable through
  `maxTotalDetections`.
- Maximum detector execution count per operation: configurable through
  `maxDetectorRuns`.
- Circular reference behavior: fail closed with `circular_reference`.
- Non-plain object behavior: fail closed with `unsupported_json_like`.
- Content-bearing object key behavior: fail closed with `unsafe_object_key`.

The JSON-like traversal applies aggregate defaults to avoid turning redaction into
a denial-of-service amplifier:

- `maxTotalStringLength`: 1,000,000 UTF-16 code units.
- `maxTotalNodes`: 10,000 visited nodes.
- `maxTotalDetections`: 10,000 selected detections.
- `maxDetectorRuns`: 50,000 detector executions.

Malformed JSON string parsing is not implemented yet; callers can pass parsed
tool argument objects or strings for text redaction.

## Safety Rules

- Preserve object shape when safe so callers can debug redaction location.
- Do not export raw object keys or full field paths in warnings or telemetry by
  default; paths can reveal business domain information or user-provided values.
- If traversal limits are exceeded, fail closed for content export and emit safe
  warnings.

## Review Blockers

- Limit failures return partially redacted content as safe.
- Telemetry summaries include sensitive field paths by default.
- Traversal flattens nested tool arguments without documented tradeoffs.
