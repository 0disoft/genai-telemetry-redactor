# Package Surface

Status: Product-shaping
Repository Type: library

## Repository Type Contract

This repository type owns public API surface, package compatibility, semantic versioning, migration guidance, distribution artifacts, and consumer-facing deprecation policy.

## Source of Truth

- Product decision: publish a small embeddable redaction package.
- Technical owner: repository owner
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- Public API ownership: documented exports only; internal detector utilities should
  remain private unless there is a consumer use case.
- Semantic versioning policy: public export changes and result-shape changes are
  semver-significant.
- Runtime and platform compatibility: Node.js `>=22.14.0`, ESM-only TypeScript
  package output, no browser or edge support promise in the first implementation.
- Package artifact and export surface: no CLI, server, DB migration, or hosted worker
  is part of the initial package surface.
- Deprecation and migration policy: old redaction result shapes should receive a
  migration guide before removal.

## Review Blockers

- Public exports change without semver and migration notes.
- Compatibility claims lack runtime or consumer evidence.
- Package artifacts drift from documented public API.
- Package files include fixtures with real-looking secrets that could be mistaken for
  live credentials.
