# Library

Status: Product-shaping
Repository Type: library

## Repository Type Contract

This repository type owns public API surface, package compatibility, semantic versioning, migration guidance, distribution artifacts, and consumer-facing deprecation policy.

## Source of Truth

- Product decision: expose a small redaction core plus telemetry mapping helpers.
- Technical owner: repository owner
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- Public API ownership: detector interfaces, redaction policy, redaction result,
  replacement-token policy, provider adapter contracts, and telemetry mapper contracts.
- Semantic versioning policy: public exports and redaction result shapes follow semver.
- Runtime and platform compatibility: TypeScript-oriented package; exact runtime floor
  remains UNDECIDED until implementation.
- Package artifact and export surface: library exports only; no hosted service or
  generated application code.
- Deprecation and migration policy: security-affecting behavior changes require
  migration notes and before/after examples.

## Review Blockers

- Public exports change without semver and migration notes.
- Compatibility claims lack runtime or consumer evidence.
- Package artifacts drift from documented public API.
- A public API makes raw content capture the default.
- A public API exposes detector internals that would make future detector fixes
  semver-hostile.
