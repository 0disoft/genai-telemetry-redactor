# SDK Public API

Status: Product-shaping
Repository Type: sdk

## Repository Type Contract

This repository type owns public API, compatibility, examples, versioning, and consumer migration.

## Source of Truth

- Product decision: make safe integration the default path for callers.
- Technical owner: repository owner
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- SDK ownership boundary: adapter helpers for GenAI request/response boundaries, not
  model routing or telemetry storage.
- SDK public contract: `withRedactedTelemetry`, provider adapter hooks, detector
  configuration, capture policy, and redaction report callbacks.
- SDK non-ownership: provider credentials, retry policy, routing, tenant
  authorization, telemetry exporter configuration, and prompt storage stay with the
  caller.
- SDK validation evidence: examples must use fake sample values and fixture-backed
  expected redaction reports.
- SDK release or rollout policy: new provider wrappers ship behind explicit adapter
  selection.
- SDK compatibility and migration policy: wrapper behavior changes require migration
  notes and before/after examples.

## Initial SDK Use Cases

- Wrap an OpenAI-compatible client call and emit metadata-only telemetry.
- Redact nested tool arguments before creating telemetry events.
- Register a custom detector for project-specific identifiers.
- Inspect redaction counts without reading raw content.

## Documented Export Inventory

<!-- sdk-api-inventory:start -->
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
<!-- sdk-api-inventory:end -->

## Implemented SDK Surface

- `withRedactedTelemetry(options)`: explicit-adapter helper for already available
  OpenAI-compatible request and optional response payloads.
- `options.adapter` currently accepts `"openai-compatible"` only. New provider
  wrappers must remain explicit adapter selections.
- `options.redaction` accepts inline core detector and replacement configuration
  or a reusable `{ profile, signal? }` operation and passes it to the selected
  adapter.
- `options.redaction.limits.maxTotalDurationMs` spans the complete SDK operation,
  including both request and optional response redaction. The response receives
  only the duration left after request processing.
- `options.openAICompatible.redactToolNames` opts in to tool-name redaction when
  caller policy treats tool names as content-bearing.
- Adapter-specific options are not allowed to override core redaction policy.
  For example, `openAICompatible` cannot disable built-in detectors; callers must
  use `options.redaction` for detector policy.
- `options.telemetry` passes safe metadata candidates to the OTel metadata mapper.
- `options.reportContext` accepts caller-owned `operationId`, `attemptId`, and
  `idempotencyKey` values for retry-safe report callback writes. These values are
  treated as labels, not content; unsafe values are dropped and listed by key.
  The SDK preserves the key for caller-owned deduplication but does not keep an
  internal idempotency cache or suppress duplicate callback invocations.
- `options.onReport(report, telemetry)` receives redaction report and safe metadata
  only, not raw request or response payloads. The callback also receives safe
  report context so external metrics, logs, or audit writes can deduplicate
  retries without reading payload content. If the callback throws, the SDK keeps
  the redacted result and adds `report_callback_failed` to returned warnings and
  telemetry warning codes.
- Executable SDK examples cover OpenAI-compatible request-only wrapping,
  request/response wrapping, tool-call argument redaction, report callbacks, and
  timing metadata without storing raw payload content.
- On any redaction failure, the helper returns `ok: false`, safe error details,
  metadata, report, and warnings without returning partially redacted payloads.
- Unknown adapter names from untyped JavaScript callers return a safe failure
  instead of `undefined`.
- SDK option inspection failures from getters or proxies return
  `invalid_redaction_options` with metadata-only failure telemetry instead of
  rejecting with the original exception.

## Non-Ownership

- The helper does not invoke provider SDKs or HTTP clients.
- The helper does not own credentials, retries, routing, tenant authorization,
  telemetry exporter configuration, prompt storage, or model gateway behavior.
- The helper does not redact streaming chunk content; streaming remains
  metadata-only until streaming redaction is proven.

## Review Blockers

- SDK examples drift from public API.
- Compatibility claims lack runtime or consumer evidence.
- SDK behavior hides partial-redaction warnings from callers.
- SDK wrappers export streaming content before streaming redaction is proven.
