# Public API

Status: Product-shaping
Repository Type: library

## Repository Type Contract

This repository type owns public API surface, package compatibility, semantic versioning, migration guidance, distribution artifacts, and consumer-facing deprecation policy.

## Source of Truth

- Product decision: expose redaction and telemetry mapping contracts, not a gateway or
  storage service.
- Technical owner: repository owner
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- Public API ownership: `redactText` first, then prompt/completion/tool argument
  helpers, provider adapters, detector hooks, replacement-token configuration,
  redaction result reports, and OpenTelemetry metadata mapper helpers.
- Package boundary ownership: core redaction must stay provider-agnostic; adapters
  own provider shapes; OTel helpers own safe metadata mapping; SDK helpers own caller
  ergonomics only.
- Semantic versioning policy: detector defaults, replacement token categories, result
  field names, and mapper output shape are public contracts once released.
- Runtime and platform compatibility: Node.js `>=22.14.0` with ESM-only
  TypeScript output; APIs must avoid assuming a server, database, or telemetry
  backend.
- Package artifact and export surface: library package with documented exports only.
- Deprecation and migration policy: breaking output-shape or default-detector changes
  require migration notes and corpus examples.

## Initial API Shape

- Input: provider payloads, plain strings, message arrays, tool argument objects, and
  optional policy.
- Output: sanitized value, redaction report, warnings, and safe telemetry metadata.
- Default: content capture disabled and raw input never written to logs.

## Documented Export Inventory

<!-- public-api-inventory:start -->

### Export `.`

- `AnthropicMessagesOptions`
- `AnthropicMessagesRedactionOptions`
- `BufferedTextStreamChunk`
- `BufferedTextStreamRedactor`
- `BuiltInDetectorName`
- `BuiltInRollingTextStreamOptions`
- `createBufferedTextStreamRedactor`
- `createBuiltInRollingTextStreamRedactor`
- `createBuiltInDetectors`
- `createRedactionProfile`
- `createRegexDetector`
- `defaultReplacementToken`
- `Detection`
- `DetectionContext`
- `Detector`
- `mapRedactionReportToGenAIMetadata`
- `OpenAICompatibleOptions`
- `OpenAICompatibleRedactionOptions`
- `OpenAICompatibleStreamRedactionMetadata`
- `OtelAttributeValue`
- `OtelGenAIAttributeMap`
- `OtelGenAIMetadata`
- `OtelGenAIMetadataMapper`
- `OtelGenAIMetadataOptions`
- `OtelGenAITokenUsage`
- `RedactedTelemetryAdapter`
- `RedactedTelemetryReportCallback`
- `RedactedTelemetryReportContext`
- `RedactionLimits`
- `RedactionOperationOptions`
- `RedactionOptions`
- `RedactionProfile`
- `RedactionProfileConfig`
- `RedactionProfileCreationResult`
- `RedactionProfileExecutionOptions`
- `RedactionReason`
- `RedactionReport`
- `RedactionResult`
- `RedactionTimings`
- `RedactionWarning`
- `RedactionWarningCode`
- `redactAnthropicMessagesRequest`
- `redactAnthropicMessagesResponse`
- `RegexDetectorOptions`
- `redactJsonLike`
- `redactOpenAICompatibleRequest`
- `redactOpenAICompatibleResponse`
- `redactOpenAICompatibleStreamEvent`
- `redactText`
- `redactToolArguments`
- `ReplacementTokenPolicy`
- `RollingTextStreamChunk`
- `RollingTextStreamRedactor`
- `SafeRedactionError`
- `SafeRedactionErrorCode`
- `withRedactedTelemetry`
- `WithRedactedTelemetryFailure`
- `WithRedactedTelemetryOptions`
- `WithRedactedTelemetryResult`
- `WithRedactedTelemetrySuccess`
- `WithRedactedTelemetryValue`

### Export `./anthropic-messages`

- `AnthropicMessagesOptions`
- `AnthropicMessagesRedactionOptions`
- `redactAnthropicMessagesRequest`
- `redactAnthropicMessagesResponse`

### Export `./core`

- `BufferedTextStreamChunk`
- `BufferedTextStreamRedactor`
- `BuiltInDetectorName`
- `BuiltInRollingTextStreamOptions`
- `createBufferedTextStreamRedactor`
- `createBuiltInRollingTextStreamRedactor`
- `createBuiltInDetectors`
- `createRedactionProfile`
- `createRegexDetector`
- `defaultReplacementToken`
- `Detection`
- `DetectionContext`
- `Detector`
- `RedactionLimits`
- `RedactionOperationOptions`
- `RedactionOptions`
- `RedactionProfile`
- `RedactionProfileConfig`
- `RedactionProfileCreationResult`
- `RedactionProfileExecutionOptions`
- `RedactionReason`
- `RedactionReport`
- `RedactionResult`
- `RedactionTimings`
- `RedactionWarning`
- `RedactionWarningCode`
- `RegexDetectorOptions`
- `redactJsonLike`
- `redactText`
- `redactToolArguments`
- `ReplacementTokenPolicy`
- `RollingTextStreamChunk`
- `RollingTextStreamRedactor`
- `SafeRedactionError`
- `SafeRedactionErrorCode`

### Export `./openai-compatible`

- `OpenAICompatibleOptions`
- `OpenAICompatibleRedactionOptions`
- `OpenAICompatibleStreamRedactionMetadata`
- `redactOpenAICompatibleRequest`
- `redactOpenAICompatibleResponse`
- `redactOpenAICompatibleStreamEvent`

### Export `./otel`

- `mapRedactionReportToGenAIMetadata`
- `OtelAttributeValue`
- `OtelGenAIAttributeMap`
- `OtelGenAIMetadata`
- `OtelGenAIMetadataMapper`
- `OtelGenAIMetadataOptions`
- `OtelGenAITokenUsage`

### Export `./sdk`

- `RedactedTelemetryAdapter`
- `RedactedTelemetryReportCallback`
- `RedactedTelemetryReportContext`
- `withRedactedTelemetry`
- `WithRedactedTelemetryFailure`
- `WithRedactedTelemetryOptions`
- `WithRedactedTelemetryResult`
- `WithRedactedTelemetrySuccess`
- `WithRedactedTelemetryValue`

<!-- public-api-inventory:end -->

## Implemented Core Surface

- `redactText(input, options)`: async provider-agnostic text redaction.
- `createRedactionProfile(config)`: validates and snapshots one reusable core
  detector, limit, and replacement policy. Creation returns a discriminated
  result and fails with `invalid_redaction_profile` for unsafe static
  composition.
- `RedactionOperationOptions`: existing `RedactionOptions` or the mutually
  exclusive profile-backed `{ profile, signal? }` shape accepted by core
  redaction operations.
- Inline operation options reject unknown keys, malformed limits, non-function
  replacement policies, and invalid abort signals with
  `invalid_redaction_options` instead of silently falling back to defaults.
- `createBufferedTextStreamRedactor(options)`: explicit final-flush buffered
  stream redactor. `push(chunk)` omits intermediate content, and `close()`
  redacts the complete buffer before returning content. Calls to `push()` after
  close fail with `stream_closed`; repeated `close()` calls fail with
  `stream_already_closed`.
- `createBuiltInRollingTextStreamRedactor(options)`: built-in-only rolling
  helper that returns redacted content through proven whitespace boundaries,
  retains bearer-scheme context, and final-flushes the remaining suffix.
  Custom detectors, reusable profiles, empty built-in selection, retained
  buffer overflow, cumulative budget exhaustion, and overlapping operations
  fail closed without returning the retained suffix.
- `redactJsonLike(input, options)`: async JSON-like traversal that redacts string
  leaves while preserving safe plain-object and array shape. Non-plain objects
  and content-bearing object keys fail closed instead of being coerced or echoed
  in warning paths.
- `RedactionLimits`: per-value and aggregate operation budgets for string length,
  object depth, object keys, array length, node count, redaction count, and
  detector count. JSON-like traversal additionally tracks cumulative detector
  executions with `maxDetectorRuns`, including object-key safety checks. Async
  detector duration can also be bounded with `maxDetectorDurationMs`, and the
  whole operation can be bounded with `maxTotalDurationMs`. Explicit buffered
  and rolling streaming can bound retained content with
  `maxStreamBufferLength`; rolling streaming also keeps total string,
  detection, detector-run, and duration budgets cumulative across flushes.
- `redactToolArguments(input, options)`: tool-argument redaction wrapper over
  JSON-like traversal.
- `createBuiltInDetectors(names)`: built-in detector construction.
- `createRegexDetector(options)`: helper for caller-owned regex detectors that
  defaults detections to whole-match UTF-16 ranges and allows explicit submatch
  range mapping.
- `defaultReplacementToken(reason)`: category-only replacement token policy.
  Unsafe custom reason labels fall back to a generic custom category instead of
  being echoed into redacted output.
- Public types for detectors, detections, warnings, reports, safe errors, and
  redaction results.
- `RedactionReport.timings`: safe numeric redaction metrics for operation
  duration, detector duration, detector run count, visited node count, and
  processed UTF-16 string code-unit count. Timings never include raw content,
  field paths, detector IDs, matched values, custom reason labels, or
  per-detector timing series.

## Implemented OpenAI-Compatible Adapter Surface

- `redactOpenAICompatibleRequest(input, options)`: structural request redaction for
  `messages`, `prompt`, and `input` fields without importing a provider SDK.
- `redactOpenAICompatibleResponse(input, options)`: structural response redaction
  for `choices`, completion text, message content, tool calls, and tool-call
  function arguments.
- `redactOpenAICompatibleStreamEvent(input)`: metadata-only streaming helper that
  omits chunk content and emits `streaming_content_omitted`.
- `OpenAICompatibleOptions`: core redaction options plus explicit
  `redactToolNames` opt-in for tool names when caller policy treats names as
  content-bearing.
- `OpenAICompatibleRedactionOptions`: inline core options or the reusable
  profile-backed operation shape accepted by adapter request and response
  helpers.
- Malformed JSON string tool arguments fail closed with
  `malformed_tool_arguments` and return no provider payload.

## Implemented Anthropic Messages Adapter Surface

- `redactAnthropicMessagesRequest(input, options)`: structural request redaction
  for top-level `system`, message string content, `text` blocks, assistant
  `tool_use.input`, user `tool_result.content`, and content-bearing request
  metadata structures.
- `redactAnthropicMessagesResponse(input, options)`: structural response
  redaction for `text` blocks, assistant `tool_use.input`, and usage structure.
- The adapter has no Anthropic SDK dependency and owns no credentials, HTTP
  transport, retries, routing, telemetry export, or prompt storage.
- Tool names remain metadata by default and can be redacted through the explicit
  `redactToolNames` adapter policy.
- Unknown top-level fields, unknown content block types, role/block mismatches,
  accessors, symbols, and non-plain objects fail closed with
  `unsupported_provider_shape` and return no provider payload.
- Image, document, search-result, thinking, redacted-thinking, server-tool, and
  beta-only blocks are intentionally unsupported until dedicated fixtures and
  content policies are reviewed.

## Implemented OpenTelemetry Metadata Surface

- `mapRedactionReportToGenAIMetadata(report, options)`: metadata-only mapper from
  redaction reports and safe GenAI metadata candidates to an attribute object.
- The mapper emits official OpenTelemetry GenAI attributes for operation,
  provider, request model, response model, and non-negative integer input/output
  token usage.
- `providerName` describes the actual provider, not the adapter shape. Callers
  should use the upstream well-known provider value when one applies.
- The mapper emits library-specific redaction, content-capture, semconv-source, and
  latency attributes under `genai_redactor.*`.
- Caller-provided total token usage is emitted as
  `genai_redactor.usage.total_tokens`; the pinned upstream convention does not
  define `gen_ai.usage.total_tokens`.
- Unsafe label-like metadata values are dropped and counted instead of exported.
- Warning paths, detector IDs, raw provider payloads, prompt text, completion text,
  tool arguments, credentials, and span writer objects are outside the mapper API.

## Implemented SDK Surface

- `withRedactedTelemetry(options)`: explicit-adapter helper that combines
  OpenAI-compatible or Anthropic Messages redaction and OTel metadata mapping.
- The helper returns redacted request/response payloads only when every requested
  redaction step succeeds.
- On failure, the helper returns safe metadata, report, warnings, and safe error
  details without returning partial payloads.
- Unknown adapter names from untyped callers return a safe failure, and
  adapter-specific option bags cannot override core detector policy.
- The helper accepts optional report callbacks that receive reports and metadata
  only. Callback exceptions are converted to a `report_callback_failed` warning
  so redacted payloads are not discarded after successful redaction.

## Review Blockers

- Public exports change without semver and migration notes.
- Compatibility claims lack runtime or consumer evidence.
- Package artifacts drift from documented public API.
- API examples include real secrets or private customer text.
- Core APIs accept provider SDK objects, telemetry exporters, or raw span writers
  directly.
