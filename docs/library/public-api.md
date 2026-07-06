# Public API

Status: Product-shaping
Repository Type: library

## Repository Type Contract

This repository type owns public API surface, package compatibility, semantic versioning, migration guidance, distribution artifacts, and consumer-facing deprecation policy.

## Source of Truth

- Product decision: expose redaction and telemetry mapping contracts, not a gateway or
  storage service.
- Technical owner: repository owner
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- Public API ownership: `redactPrompt`, `redactCompletion`, `redactToolArguments`,
  provider adapters, detector hooks, replacement-token configuration, redaction result
  reports, and OpenTelemetry metadata mapper helpers.
- Package boundary ownership: core redaction must stay provider-agnostic; adapters
  own provider shapes; OTel helpers own safe metadata mapping; SDK helpers own caller
  ergonomics only.
- Semantic versioning policy: detector defaults, replacement token categories, result
  field names, and mapper output shape are public contracts once released.
- Runtime and platform compatibility: Node.js `>=22.14.0` with ESM-only
  TypeScript output; APIs must avoid assuming a server, database, or telemetry
  backend.
- Package artifact and export surface: library package with documented exports only.
- Deprecation and migration policy: breaking output-shape or default-detector changes
  require migration notes and corpus examples.

## Initial API Shape

- Input: provider payloads, plain strings, message arrays, tool argument objects, and
  optional policy.
- Output: sanitized value, redaction report, warnings, and safe telemetry metadata.
- Default: content capture disabled and raw input never written to logs.

## Review Blockers

- Public exports change without semver and migration notes.
- Compatibility claims lack runtime or consumer evidence.
- Package artifacts drift from documented public API.
- API examples include real secrets or private customer text.
- Core APIs accept provider SDK objects, telemetry exporters, or raw span writers
  directly.
