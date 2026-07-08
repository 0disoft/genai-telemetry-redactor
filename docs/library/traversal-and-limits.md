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
- Maximum detector count per text value or key check: configurable through
  `maxDetectors`.
- Maximum cumulative detector execution count per JSON-like traversal:
  configurable through `maxDetectorRuns`. Object key checks and string value
  checks both count against this budget.
- Maximum per-detector duration for async detectors: configurable through
  `maxDetectorDurationMs`.
- Maximum total redaction operation duration: configurable through
  `maxTotalDurationMs`.
- Circular reference behavior: fail closed with `circular_reference`.
- Non-plain object behavior: fail closed with `unsupported_json_like`.
- Content-bearing object key behavior: fail closed with `unsafe_object_key`.
- Shared reference behavior: reuse the first redacted clone for repeated
  references to the same object, without re-running descendant redaction or
  double-counting descendant detections. Circular references still fail closed
  with `circular_reference`.

The JSON-like traversal applies aggregate defaults to avoid turning redaction into
a denial-of-service amplifier:

- `maxTotalStringLength`: 1,000,000 UTF-16 code units.
- `maxTotalNodes`: 10,000 visited nodes.
- `maxTotalDetections`: 10,000 selected detections.
- `maxDetectorRuns`: 50,000 detector executions.

`redactText` uses `maxDetectors` to cap how many detectors may run for a single
input string. It does not interpret `maxDetectorRuns` as a detector-count limit.
`redactJsonLike` uses `maxDetectorRuns` as an aggregate traversal budget and
applies `maxDetectors` before each key or value detector pass.

Per-detector duration has no default timeout because existing synchronous
detectors cannot be preempted safely. When configured, async detectors receive an
abort signal and deadline and timeout with `detector_timeout`.

Total operation duration also has no default timeout. When configured,
`maxTotalDurationMs` bounds the whole redaction operation across traversal,
object-key checks, string redaction, and async detector work. Exceeding the total
budget fails closed with `max_total_duration_exceeded`; async detectors receive
the earlier of the per-detector deadline and the remaining total-operation
deadline. Synchronous detector or regex execution still cannot be interrupted
mid-call, so the total budget is checked before dispatch, after control returns,
and while moving between traversal steps.

Redaction reports may include `timings` with numeric operation duration,
detector duration, and detector run count. These metrics are safe summaries only
and must not include object paths, detector IDs, matched values, or raw content.

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
