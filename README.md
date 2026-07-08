# GenAI Telemetry Redactor

Status: Active
Scope: backend
Repository Type: library
Addons: sdk

GenAI Telemetry Redactor is a library and SDK surface for redacting sensitive content
from LLM telemetry before it reaches logs, spans, events, or observability backends.

The project focuses on prompt, completion, and tool-argument boundaries. It keeps
content capture off by default, maps safe metadata to OpenTelemetry GenAI conventions,
and reports redaction counts and reasons without preserving raw user content.

## Install

```sh
npm install genai-telemetry-redactor
```

## Quick Start

```ts
import { withRedactedTelemetry } from "genai-telemetry-redactor";

const result = await withRedactedTelemetry({
  adapter: "openai-compatible",
  request: {
    model: "model_example",
    messages: [
      {
        role: "user",
        content: "Contact user@example.invalid with token_example_value",
      },
    ],
  },
  telemetry: {
    operationName: "chat",
    providerName: "openai-compatible",
    requestModel: "model_example",
  },
});

if (!result.ok) {
  throw new Error(result.error.code);
}

console.log(result.value.redactedRequest);
console.log(result.value.telemetry.attributes);
```

The helper returns redacted request and response payloads plus metadata-only
telemetry attributes. It does not call a model provider, own credentials, export
spans, store prompts, or guarantee perfect sensitive-data detection.

## Limit and Report Notes

`maxDetectors` limits how many detectors may run for one text or object-key
check. `maxDetectorRuns` limits cumulative detector executions during JSON-like
traversal, including object-key safety checks. `maxTotalDurationMs` bounds the
whole redaction operation and fails closed with `max_total_duration_exceeded`
when the budget is exceeded.

`createBufferedTextStreamRedactor` is an explicit final-flush streaming helper.
It buffers string chunks, omits content from intermediate `push(chunk)` results,
and returns redacted content only from `close()`. OpenAI-compatible streaming
adapters remain metadata-only by default.

Redaction reports may include numeric `timings` such as operation duration,
detector duration, and detector run count. These metrics are safe summaries only:
they do not include matched values, raw content, detector IDs, or field paths.

`onReport` callback failures do not discard already redacted results. The SDK
returns a `report_callback_failed` warning so callers can observe the callback
failure without exporting partial or raw payloads.

Custom regex detectors should follow
`docs/security/custom-regex-redos-guidance.md`. Length limits and async detector
timeouts are guardrails, but synchronous JavaScript regex evaluation cannot be
preempted once a backtracking-heavy pattern is running.

## Source Files

- AGENTS.md: agent working rules
- CHECKLIST.md: checklist router
- VALIDATION.md: validation names and reporting requirements
- LICENSE: Apache-2.0 license
- SECURITY.md: security reporting and fixture safety policy
- .agents/context-map.md: agent route map
- docs/: design, operations, architecture, and engineering standards
- docs/product/02-spec.md: durable product contract
- docs/library/public-api.md: public library API boundary
- docs/sdk/public-api.md: SDK integration boundary
- docs/backend/06-logging-and-observability.md: telemetry mapping and content-capture policy
- docs/engineering/04-security-baseline.md: security and redaction safety baseline
- docs/non-goals/backend-placeholders/: parked API and DB placeholders that are not
  active product contracts
- examples/: executable, fake-data-only SDK and adapter examples checked by the
  contract runner
- package.json, pnpm-workspace.yaml, tsconfig*.json, vitest.config.ts: package,
  build, and validation runner setup
- packages/core/: initial provider-agnostic redaction core
- packages/openai-compatible/: structural OpenAI-compatible request, response, and
  streaming metadata adapter
- packages/otel/: metadata-only OpenTelemetry GenAI mapping helpers
- packages/sdk/: caller ergonomics helpers that combine adapter redaction and safe
  telemetry metadata
- scripts/check-no-live-secrets.ts: repository safety guard for live-looking secrets
- scripts/check-package-surface.ts: package export and internal package surface guard
- scripts/check-package-artifact.ts: npm dry-run package artifact guard

## Repository Shape Notes

- library: This repository type owns public API surface, package compatibility, semantic versioning, migration guidance, distribution artifacts, and consumer-facing deprecation policy.
- sdk: This repository type owns public API, compatibility, examples, versioning, and consumer migration.

## MVP Boundary

The first useful version should support OpenAI-compatible request and response shapes,
nested tool arguments, a small detector set, replacement-token policy, and safe
OpenTelemetry GenAI metadata mapping.

The current implementation starts with `packages/core`: async `redactText`,
`redactJsonLike`, `redactToolArguments`, and
`createBufferedTextStreamRedactor`; built-in detectors for email, bearer token,
API-key-like strings, and URLs; category-only replacement tokens; redaction
reports; shape-preserving JSON-like traversal with shared-reference reuse; and
fail-closed detector, traversal, buffered-stream, circular-reference, overlap,
and limit behavior.

It also includes `packages/openai-compatible`: provider-SDK-free request and
response shape helpers for `messages`, `prompt`, `input`, `choices`, completion
text, message content, and tool-call function arguments. Unsupported shapes fail
closed with `unsupported_provider_shape`, malformed JSON tool arguments are
redacted as text with a warning, and streaming events return metadata-only
`streaming_content_omitted` results instead of exporting chunk content.

`packages/otel` starts the OpenTelemetry boundary with
`mapRedactionReportToGenAIMetadata`: a pure metadata mapper that accepts redaction
reports and safe GenAI metadata candidates, keeps content capture disabled, and
exports official GenAI operation/provider/model/token attributes plus
library-specific `genai_redactor.*` redaction metadata without accepting raw
provider payloads or span writer objects.

`packages/sdk` starts the SDK ergonomics boundary with `withRedactedTelemetry`:
an explicit-adapter helper that redacts OpenAI-compatible request and response
payloads, returns safe telemetry metadata, and invokes optional report callbacks
without owning provider credentials, retries, routing, transport, telemetry
exporters, or prompt storage.

`examples` contains executable TypeScript samples for the first safe integration
paths: OpenAI-compatible request-only wrapping, request/response wrapping, tool
call argument redaction with a report callback, custom detector registration,
and streaming metadata-only handling. The contract runner imports these samples
against built package exports so example drift is treated as a package contract
failure.

The MVP must not become a telemetry backend, model gateway, prompt store, legal
compliance product, or full DLP platform.

Streaming content export is not part of the first safe path. Streaming telemetry
must remain metadata-only until an ADR, rolling-buffer policy, and chunk-boundary
fixtures prove redaction behavior.

## Repository Hygiene

.editorconfig, .gitattributes, and .gitignore are generated to keep line endings,
binary diffs, local files, build outputs, caches, and secret files under control.

## Scope Notes

Runtime packaging is decided as Node.js `>=22.14.0`, ESM-only TypeScript, and a
pnpm workspace with one initial npm package named `genai-telemetry-redactor`.
The OpenTelemetry GenAI semantic-convention source is tracked as the upstream
Development GenAI convention, so custom redaction metadata stays under the
`genai_redactor.*` namespace. Package exports point at compiled `dist`
JavaScript and declaration files emitted from the TypeScript source. The product
boundary is already decided: redact before export, capture content only by
explicit opt-in, and never treat redaction as perfect sensitive-data discovery.
