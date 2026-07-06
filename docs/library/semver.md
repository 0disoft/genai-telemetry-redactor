# Semantic Versioning

Status: Product-shaping
Repository Type: library

## Repository Type Contract

This repository type owns public API surface, package compatibility, semantic versioning, migration guidance, distribution artifacts, and consumer-facing deprecation policy.

## Source of Truth

- Product decision: treat redaction output shapes and defaults as public behavior.
- Technical owner: repository owner
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- Public API ownership: exported functions, detector hook signatures, redaction report
  fields, warning codes, and telemetry mapper outputs.
- Semantic versioning policy: stricter defaults may be minor when they only redact more
  categories safely; output removals, renamed fields, or default raw-content capture
  behavior are major.
- Runtime and platform compatibility: runtime floor changes are semver-significant.
- Package artifact and export surface: adding optional provider adapters can be minor;
  changing core adapter contracts is major.
- Deprecation and migration policy: security fixes may ship quickly, but migration notes
  must state behavior changes.

## Review Blockers

- Public exports change without semver and migration notes.
- Compatibility claims lack runtime or consumer evidence.
- Package artifacts drift from documented public API.
- A release changes redaction behavior without fixture-backed release notes.
