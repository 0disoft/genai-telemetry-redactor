# Compatibility

Status: Product-shaping
Repository Type: library

## Repository Type Contract

This repository type owns public API surface, package compatibility, semantic versioning, migration guidance, distribution artifacts, and consumer-facing deprecation policy.

## Source of Truth

- Product decision: support stable redaction behavior before broad runtime claims.
- Technical owner: repository owner
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- Public API ownership: core redaction contracts and mapper outputs.
- Semantic versioning policy: changes to default detector behavior and replacement
  categories require compatibility notes.
- Runtime and platform compatibility: exact runtime matrix remains UNDECIDED until
  package tooling exists.
- Package artifact and export surface: compatibility applies to documented library and
  SDK entrypoints only.
- Deprecation and migration policy: users must be told when detector defaults become
  stricter or looser.

## Review Blockers

- Public exports change without semver and migration notes.
- Compatibility claims lack runtime or consumer evidence.
- Package artifacts drift from documented public API.
- Runtime support is claimed without a real runtime check.
- Provider support is claimed without representative payload fixtures.
