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

## Review Blockers

- SDK examples drift from public API.
- Compatibility claims lack runtime or consumer evidence.
- SDK behavior hides partial-redaction warnings from callers.
- SDK wrappers export streaming content before streaming redaction is proven.
