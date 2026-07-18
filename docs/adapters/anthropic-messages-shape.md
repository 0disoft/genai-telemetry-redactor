# Anthropic Messages Shape

Status: Active

## Contract

The Anthropic Messages adapter redacts supported request and response payload
shapes without importing an Anthropic SDK or making provider calls. It is a
payload boundary only: credentials, HTTP transport, retries, routing, model
selection, and telemetry export remain caller-owned.

The wire-shape reference is Anthropic's Messages API and tool-use documentation:

- https://platform.claude.com/docs/en/api/messages
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls

## Supported Content

- Top-level request `system` as a string or an array of `text` blocks.
- Request `messages[].content` as a string or an array of supported blocks.
- Request and response `text` blocks.
- Assistant `tool_use` blocks with redacted structured `input`.
- User `tool_result` blocks with omitted, string, or nested `text` block
  `content`.
- Content-bearing request `metadata`, `stop_sequences`, `tools`, and
  `tool_choice` structures through provider-agnostic JSON-like redaction.
- Response `usage` through provider-agnostic JSON-like validation.

Tool names are treated as metadata by default. Callers may set
`redactToolNames: true` when their policy treats tool names as content-bearing.
Tool-use ids remain structural correlation values, matching the existing
OpenAI-compatible adapter policy for tool-call ids.

## Failure Policy

Unknown top-level fields, unknown content block types, accessors, symbols,
non-plain objects, malformed metadata, and role/block mismatches fail closed
with `unsupported_provider_shape`. The failed result never returns a provider
payload.

The initial adapter intentionally rejects image, document, search-result,
thinking, redacted-thinking, server-tool, and provider-beta blocks. Those shapes
can carry content or opaque provider state and need dedicated fixtures before
they are allowlisted.

All redaction limits are cumulative across one adapter request or response.
When used through `withRedactedTelemetry`, the SDK applies one cumulative budget
across both request and response payloads.

## Review Blockers

- Provider SDK types or credentials enter the core package.
- Unknown blocks are copied through without inspection.
- A tool input or tool result is returned after partial redaction failure.
- Adapter-specific options override the caller's core redaction policy.
- Fixtures contain real prompts, credentials, private identifiers, or customer
  data.
