# Roadmap

Status: Product-shaping
Owner: repository owner

## Purpose

This roadmap keeps the project small enough to ship as an embeddable redaction
library while leaving room for provider adapters and telemetry integrations.

## Source of Truth

- Product decision: ship redaction core before provider breadth.
- Technical owner: repository owner
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- Boundary: core redaction pipeline, explicit provider adapters, OTel metadata
  mapper, and test corpus first.
- Data ownership: no raw prompt or completion persistence.
- Failure and recovery behavior: fail closed for content export.
- Validation needed before merge: VALIDATION.md

## Milestones

1. Core redaction model: detector interface, replacement token policy, redaction report,
   and fixture-driven tests.
2. OpenAI-compatible adapter: messages, completions, tool calls, nested arguments, and
   streaming metadata-only behavior.
3. OpenTelemetry mapper: safe GenAI metadata, redaction summaries, and content-capture
   opt-in behavior.
4. SDK ergonomics: middleware/wrapper examples, custom detector hooks, and migration
   guidance.
5. Provider expansion: the Anthropic Messages adapter is the first completed
   expansion. Add further provider or Anthropic block shapes only after fixtures
   prove no raw content leaks through unsupported paths.
6. Built-in rolling streaming: the core whitespace-boundary helper is complete.
   Custom-detector and provider-adapter streaming remain blocked until their own
   boundary, ordering, and cancellation contracts are proven.

## Review Blockers

- A milestone expands into a telemetry backend, DLP suite, model gateway, or provider
  registry.
- Provider support is added without negative fixtures and unknown-shape behavior.
- Roadmap wording implies perfect sensitive-data detection.
- Streaming content export appears before chunk-boundary redaction is proven.
