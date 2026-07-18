# Anthropic Messages Adapter Boundary

Status: Accepted

## Context

The package needs a second provider payload adapter without turning core
redaction into a collection of provider SDK types. Anthropic Messages differs
from OpenAI-compatible shapes: the system prompt is top-level, messages may use
typed content blocks, assistant tool calls use `tool_use.input`, and callers
return results in user `tool_result.content` blocks.

Several Anthropic content block families can contain opaque or externally
controlled content. Copying unknown blocks through would make adapter growth a
content-leak path.

## Decision

Add a private workspace package at `packages/anthropic-messages` and publish it
through the consumer-facing `./anthropic-messages` export.

The adapter is structural and provider-SDK-free. It supports top-level `system`,
string message content, `text` blocks, assistant `tool_use` blocks, user
`tool_result` blocks, and the documented request metadata structures named in
the adapter policy. It uses the provider-agnostic core for all text, JSON-like,
and tool-argument redaction.

Unknown fields and content block types fail closed with
`unsupported_provider_shape`. Image, document, search-result, thinking,
redacted-thinking, server-tool, and beta-only blocks remain unsupported until
their content and correlation fields have dedicated fixtures and policy.

The SDK exposes this path only through explicit
`adapter: "anthropic-messages"` selection. Provider-specific option bags are
mutually exclusive, and neither adapter may override core detector policy.

## Consequences

- Core stays provider-agnostic and gains no Anthropic dependency.
- Existing OpenAI-compatible callers remain source-compatible.
- Package version `0.4.0` is a minor release because it adds a new export and
  SDK adapter union member.
- Consumers get fail-closed request and response redaction for the supported
  Anthropic Messages surface.
- Supporting additional block families requires explicit contract, fixture,
  migration, and version review.

## Source of Truth

- Product scope: `docs/product/02-spec.md`
- Adapter policy: `docs/adapters/anthropic-messages-shape.md`
- Public API: `docs/library/public-api.md`
- SDK API: `docs/sdk/public-api.md`
- Validation evidence:
  `packages/anthropic-messages/test/anthropic-messages.test.ts`

## Review Blockers

- Provider SDK objects or credentials enter core or SDK contracts.
- Unknown blocks are returned after incomplete inspection.
- Tool input or result failure returns a partial provider payload.
- Provider-specific options weaken caller-owned detector policy.
