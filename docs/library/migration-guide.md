# Migration Guide

Status: Product-shaping
Repository Type: library

## Repository Type Contract

This repository type owns public API surface, package compatibility, semantic versioning, migration guidance, distribution artifacts, and consumer-facing deprecation policy.

## Source of Truth

- Product decision: migrations must explain redaction behavior changes before API
  changes.
- Technical owner: repository owner
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- Public API ownership: exported redaction and mapping contracts.
- Semantic versioning policy: public output and default detector changes require
  migration notes.
- Runtime and platform compatibility: document runtime floor changes when introduced.
- Package artifact and export surface: document import path and export changes.
- Deprecation and migration policy: include before/after examples with fake sample
  secrets only.

## Review Blockers

- Public exports change without semver and migration notes.
- Compatibility claims lack runtime or consumer evidence.
- Package artifacts drift from documented public API.
- Migration examples contain realistic live-looking credentials or private identifiers.

## 0.5.2

The default OpenTelemetry GenAI mapping provenance now pins upstream commit
`150760c6252a4bb63c49c9915bad11997d316a15`. The three reviewed upstream
commits changed only dependency manifests and lockfiles under reference
scenarios; semantic-convention definitions and the six official attributes
emitted by the mapper are unchanged. Mapper option and output shapes remain
compatible, while the observable semconv label and source URL identify the new
audited snapshot.

## 0.5.1

Credential-shaped detector IDs and telemetry labels now also reject GitLab PAT,
PyPI token, and compact JWT shapes. The release contract scans the final built
`dist/` package in addition to source and documentation surfaces.

The built-in rolling stream avoids rescanning its retained buffer when an
appended chunk contains no whitespace, because that chunk cannot introduce a
new reviewed flush boundary. Retention, fail-closed limits, bearer context, and
final output semantics are unchanged. Public exports and option shapes are
unchanged.

## 0.5.0

The package adds `createBuiltInRollingTextStreamRedactor`,
`BuiltInRollingTextStreamOptions`, `RollingTextStreamChunk`, and
`RollingTextStreamRedactor` from the root and `./core` exports. This opt-in
helper may emit redacted content before close only through reviewed whitespace
boundaries. It retains bearer-scheme context and final-flushes the remaining
suffix.

The rolling helper rejects custom detectors, reusable profiles, and empty
built-in selection with `invalid_redaction_options`. Long whitespace-free
segments fail at `maxStreamBufferLength` instead of using a guessed fixed
holdback. Concurrent `push()` or `close()` calls fail closed with the new
`stream_operation_in_progress` code, and cumulative limits do not restart after
each flush.

Existing `createBufferedTextStreamRedactor` behavior is unchanged and remains
the required path for custom detectors and profiles. OpenAI-compatible stream
events and SDK streaming remain metadata-only.

## 0.4.0

The package adds the explicit `./anthropic-messages` export with
`redactAnthropicMessagesRequest`, `redactAnthropicMessagesResponse`,
`AnthropicMessagesOptions`, and `AnthropicMessagesRedactionOptions`.
`withRedactedTelemetry` now accepts `adapter: "anthropic-messages"` and the
optional `anthropicMessages.redactToolNames` policy.

The adapter supports top-level system prompts, string and text-block message
content, assistant `tool_use.input`, and user `tool_result.content`. Unknown or
unreviewed block types fail closed with `unsupported_provider_shape`; callers
that need image, document, search-result, thinking, or server-tool blocks should
keep those payloads out of telemetry until a later adapter contract adds them.

Existing OpenAI-compatible APIs remain source-compatible. Adapter-specific SDK
option bags are now rejected when used with the other provider adapter instead
of being silently ignored.

## 0.3.1

The default OpenTelemetry GenAI mapping provenance now pins upstream commit
`c26a2c21d1ee70d5231bd440c7b48d3c94ee506a`. The reviewed upstream range did
not change the six official attributes emitted by the mapper, so mapper option
and output shapes are unchanged. The observable
`genai_redactor.otel.genai.semconv.label` and source URL now identify the new
snapshot.

The scheduled drift workflow now writes a job summary, reopens the single drift
review issue when drift returns, and closes that issue after the pin catches up.

## 0.3.0

The OpenTelemetry GenAI mapper now pins its Development provenance to upstream
commit `93a59e48a9b4ea162a4d76edac4ace2d415a759e` instead of moving `main`.
`gen_ai.usage.input_tokens` and `gen_ai.usage.output_tokens` now reject values
that are not non-negative safe integers. The upstream snapshot does not define
`gen_ai.usage.total_tokens`, so a valid `tokenUsage.totalTokens` value now maps
to `genai_redactor.usage.total_tokens`. Mapper function signatures are unchanged.

## 0.2.7

The release workflow now submits packages through npm staged publishing instead
of moving `latest` directly. It runs the pinned `0.2.6` baseline and current
packed-artifact consumer fixture before staging. A maintainer must approve the
stage with npm 2FA, then rerun the tag workflow to verify the exact public
registry version. Package exports and runtime behavior are unchanged.

## 0.2.6

Consumer compatibility automation now verifies the pinned `0.2.5` npm baseline
and the current packed artifact with one TypeScript declaration and ESM runtime
fixture. Pull requests and `main` run the current-tarball matrix; releases rerun
it against the exact published version. Public package behavior is unchanged.

## 0.2.5

Lossless JSON tool-argument reconstruction now applies all changed string tokens
in one forward pass instead of repeatedly copying the whole payload. A bounded
valid and invalid JSON corpus covers numeric forms, escapes, decoded duplicate
keys, and maximum-default-array redaction without changing the public API.

## 0.2.4

Malformed OpenAI-compatible JSON string tool arguments now fail closed with
`malformed_tool_arguments` and return no redacted provider payload. The previous
whole-string fallback could not reliably inspect escaped values inside malformed
JSON.

Buffered stream lifecycle misuse now has dedicated safe errors. `push()` after
close returns `stream_closed`, while repeated `close()` returns
`stream_already_closed`. A rejected push does not replace the terminal closed
state.

## 0.2.3

OpenAI-compatible JSON string tool arguments no longer pass numeric values
through JavaScript `number` conversion. The adapter now replaces only redacted
string tokens in the original JSON, preserving large integers, decimal and
exponent spellings, whitespace, and unchanged string escapes. Duplicate object
keys now fail closed so no shadowed or escaped value can bypass structured
inspection.

## 0.2.2

JSON-like traversal now accepts only JSON-serializable primitives and plain data
records. Object keys count toward the total string budget, key limits are checked
before values are read, and symbol keys, accessors, non-enumerable properties,
functions, `bigint`, `undefined`, and non-finite numbers fail closed. Own
`__proto__` data properties no longer change the output prototype.

Detector results are normalized from own data properties before range and reason
validation. Hostile accessors, oversized raw result arrays, and abort races now
produce safe failures without propagating detector exception text. Credential-
shaped detector IDs and telemetry labels are dropped or rejected.

OpenAI-compatible allowlisted metadata now receives runtime type validation, and
symbol or accessor properties fail closed instead of surviving a clone. SDK
`onReport` callbacks may return a promise; rejections add
`report_callback_failed` while preserving the redacted result. Release tags must
point to commits reachable from `main`.

## 0.2.1

OpenAI-compatible request and response helpers and the SDK
`withRedactedTelemetry` wrapper now accept profile-backed operations. This lets
applications create one validated policy and reuse it across core, adapter, and
SDK boundaries without rebuilding detector arrays for each call.

Inline operation options are now validated as a closed shape. JavaScript callers
with unknown option keys, malformed limits, invalid abort signals, or non-function
replacement policies receive `invalid_redaction_options` instead of having those
values silently ignored. TypeScript callers already matching `RedactionOptions`
need no change.

Core, adapter, SDK, and OpenTelemetry mapping boundaries now convert getter,
proxy, iterator, and detector-metadata inspection failures into safe results
without propagating original exception text. Profiles also snapshot detector
IDs, reasons, and function references, so replacing those properties after
profile creation no longer changes the validated policy.

OpenAI-compatible `response_format` and `usage` objects now pass through
JSON-like redaction instead of being copied as trusted metadata. Present
non-object values fail closed as unsupported shapes. The OpenTelemetry mapper
also allowlists report status and warning codes; unknown runtime values are
dropped rather than copied to telemetry attributes.

`maxTotalDurationMs` now uses one deadline across every field in an
OpenAI-compatible request or response and across both halves of an SDK
request/response operation. Earlier adapter calls effectively restarted this
budget for each nested core redaction.

`maxTotalDetections` and `maxDetectorRuns` now follow the same cumulative adapter
and SDK scope. A later field or response cannot reuse detection or detector-run
budget already consumed by earlier content.

Core reports now include safe `nodesVisited` and `stringCodeUnits` counters under
`timings`. Adapters use these counters to make `maxTotalNodes` and
`maxTotalStringLength` cumulative across fields and SDK request/response pairs.

## 0.2.0

`createRedactionProfile(config)` adds an immutable, reusable core policy for
detector selection, limits, and replacement behavior. Profile creation returns a
discriminated result and fails with `invalid_redaction_profile` when static
composition is unsafe.

Existing `RedactionOptions` calls remain compatible. Core callers may opt in by
passing `{ profile, signal? }` to `redactText`, `redactJsonLike`,
`redactToolArguments`, or `createBufferedTextStreamRedactor`. A profile-backed
operation cannot also override detectors, limits, or replacement behavior.

Profiles do not resolve partial detector overlaps. Callers with wider
field-level custom detectors should create a custom-only profile with
`builtInDetectors: false` instead of combining those detectors with overlapping
built-ins.

## 0.1.9

`createBufferedTextStreamRedactor(options)` is now available from the root and
`./core` exports. It is an explicit, provider-agnostic buffered streaming
prototype: `push(chunk)` returns omitted-content metadata only, and `close()`
redacts the complete buffered text before returning content.

`RedactionLimits.maxStreamBufferLength` bounds buffered UTF-16 code units for
this helper. Exceeding it fails closed with
`max_stream_buffer_length_exceeded`. OpenAI-compatible streaming adapters remain
metadata-only by default and continue to emit `streaming_content_omitted`.

## 0.1.8

`RedactionLimits` now accepts `maxTotalDurationMs` to bound the whole redaction
operation. When the budget is exceeded, core APIs fail closed with
`max_total_duration_exceeded` instead of returning partially redacted content.
Async detectors receive the earlier of their per-detector deadline and the
remaining total-operation deadline. Synchronous detector and regex execution
cannot be preempted mid-call, so callers should continue to pair this limit with
string length, detector-count, detector-run, and regex-safety controls.

The executable examples now include request-only OpenAI-compatible wrapping,
request-plus-response wrapping with timing assertions, and tool-call argument
redaction with a report callback. All examples use fake `.invalid` or
`*_example` values and are validated by the package contract runner.

## 0.1.7

`RedactionReport` can now include a `timings` object with safe numeric summaries:
`durationMs`, `detectorDurationMs`, and `detectorRuns`. The OpenTelemetry mapper
exports these under `genai_redactor.redaction.*` attributes. These fields do not
include raw content, matched values, field paths, or detector IDs.

JSON-like traversal now reuses the first redacted clone for repeated references
to the same object. This avoids double-counting descendant redactions and avoids
spending detector budget twice on the same shared object. Circular references
still fail closed with `circular_reference`.

CI now validates Node.js `22.14.0` and `24.x`.

## 0.1.6

`maxDetectorRuns` is now reserved for cumulative detector executions during
JSON-like traversal. It is no longer interpreted by `redactText` as a detector
count limit. Use `maxDetectors` when callers need to cap how many detectors can
run for one text value or object-key safety check.

Partial overlaps from different detector starts now fail closed with
`overlapping_detection`. Same-start overlaps still keep the longest range and
report omitted shorter ranges as warnings.

The SDK now preserves successful redaction results when `onReport` throws and
adds a `report_callback_failed` warning. Built-in token detection and the
repository secret scanner also cover more common cloud, source-control, Google,
Slack, and HTTP auth token shapes without requiring live-looking fixtures.

## 0.1.4

`createRegexDetector(options)` is now a public helper for regex-backed custom
detectors. Callers can provide an `id`, custom `reason`, and `pattern` without
manually calculating whole-match ranges. Callers that need to redact only a
capturing group can pass `toDetection(match)` and return explicit UTF-16 code
unit ranges.

Regex-backed detectors should still use synthetic fixtures and avoid patterns
with catastrophic backtracking on untrusted prompt, completion, or tool-argument
text.

## 0.1.3

Custom detector ranges are now explicitly validated as JavaScript UTF-16 code
unit ranges. Valid ranges are half-open `[start, end)` offsets and must not
split a surrogate pair. A detector that returns a range inside a surrogate pair
now fails closed with `invalid_detection_range` instead of producing a malformed
redacted string.

Custom detectors that calculate offsets by Unicode code point, grapheme cluster,
or byte position should convert those offsets to UTF-16 code unit indices before
returning detections.
