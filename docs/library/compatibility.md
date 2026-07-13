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
- Runtime and platform compatibility: implementation targets Node.js `>=22.14.0`
  with ESM-only TypeScript output; avoid promising browser or edge support.
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

## Automated Consumer Matrix

- `scripts/compatibility-baseline.json` pins the exact N-1 npm version. Baseline
  movement is an explicit reviewed change, not a registry `latest` lookup.
- `pnpm run compatibility` packs the current source package and runs the same
  strict TypeScript and ESM runtime fixture against the pinned baseline and the
  current tarball on Node.js 22.14.0.
- `.github/workflows/compatibility.yml` runs the matrix for pull requests and
  pushes to `main`.
- The release workflow reruns the fixture against the exact registry version
  after publish, with bounded retries for registry propagation.
- Bun `1.3.14` runs the cross-platform TypeScript automation; Node.js remains the
  consumer runtime under test.
