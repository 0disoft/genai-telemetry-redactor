# Package Boundaries

Status: Product-shaping

## Contract

The project should stay in one GitHub repository while implementation boundaries
remain visible. Implementation should use a pnpm workspace so internal packages
can separate core redaction, OpenAI-compatible shape handling, OpenTelemetry
mapping, and SDK ergonomics.

## Boundary Model

- Core redaction: detector contracts, traversal, replacement tokens, reports,
  safe errors, and fail-closed behavior.
- OpenAI-compatible adapter: request, response, tool-call, and streaming policy
  shapes; no detector implementation.
- OpenTelemetry mapping: safe metadata and redaction summary mapping; no raw
  content intake.
- SDK wrapper: caller ergonomics; no credential storage, retry ownership,
  routing, exporter ownership, or model gateway behavior.

## Implemented Boundary Notes

- `packages/sdk` may compose `packages/openai-compatible` and `packages/otel`.
- `packages/sdk` must not import provider SDKs, HTTP clients, telemetry exporters,
  filesystem persistence, or logging side effects.
- SDK failure paths must not return partially redacted request or response payloads.

## External Publishing

The first publishable artifact is one consumer-facing npm package:
`genai-telemetry-redactor`. Internal workspace packages should stay private
unless a future ADR proves independent package publishing is worth the release
overhead.

## Review Blockers

- Core imports provider SDKs, telemetry exporters, filesystem, network, or
  logging side effects.
- OTel mapping accepts raw prompts, completions, or tool arguments.
- SDK code owns provider credentials, tenant authorization, retries, routing, or
  telemetry backend configuration.
