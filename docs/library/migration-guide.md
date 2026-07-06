# Migration Guide

Status: Product-shaping
Repository Type: library

## Repository Type Contract

This repository type owns public API surface, package compatibility, semantic versioning, migration guidance, distribution artifacts, and consumer-facing deprecation policy.

## Source of Truth

- Product decision: migrations must explain redaction behavior changes before API
  changes.
- Technical owner: repository owner
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- Public API ownership: exported redaction and mapping contracts.
- Semantic versioning policy: public output and default detector changes require
  migration notes.
- Runtime and platform compatibility: document runtime floor changes when introduced.
- Package artifact and export surface: document import path and export changes.
- Deprecation and migration policy: include before/after examples with fake sample
  secrets only.

## Review Blockers

- Public exports change without semver and migration notes.
- Compatibility claims lack runtime or consumer evidence.
- Package artifacts drift from documented public API.
- Migration examples contain realistic live-looking credentials or private identifiers.
