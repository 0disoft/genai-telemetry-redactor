# SDK

Status: Product-shaping
Repository Type: sdk

## Repository Type Contract

This repository type owns public API, compatibility, examples, versioning, and consumer migration.

## Source of Truth

- Product decision: provide SDK wrappers for safe GenAI telemetry instrumentation.
- Technical owner: repository owner
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- SDK ownership boundary: wrapper and middleware helpers around caller-owned model
  clients and telemetry writers.
- SDK public contract: redaction policy input, detector hook registration, sanitized
  result output, redaction report output, and safe telemetry mapper output.
- SDK validation evidence: fixture corpus for prompts, completions, tool arguments,
  nested objects, and streaming metadata-only behavior.
- SDK release or rollout policy: no SDK release should enable content capture by
  default.
- SDK compatibility and migration policy: examples must stay aligned with public API
  and semver docs.

## Review Blockers

- SDK examples drift from public API.
- Compatibility claims lack runtime or consumer evidence.
- SDK samples log raw prompt, completion, tool argument, token, or customer content.
