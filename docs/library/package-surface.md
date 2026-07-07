# Package Surface

Status: Active
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
  source with compiled ESM JavaScript and declaration package output, no browser or
  edge support promise in the first implementation.
- Package artifact and export surface: no CLI, server, DB migration, or hosted worker
  is part of the initial package surface.
- Deprecation and migration policy: old redaction result shapes should receive a
  migration guide before removal.

## Implemented Surface Guard

- `scripts/check-package-surface.ts` verifies that each internal workspace package
  has a matching root `package.json` subpath export.
- The guard verifies root barrel exports in `src/index.ts` for each internal
  package.
- The guard verifies internal workspace packages stay private, ESM-only, and named
  with the `@genai-telemetry-redactor/<package>-internal` convention.
- `scripts/check-package-artifact.ts` runs `npm pack --dry-run --json` and verifies
  required entrypoint files are present while scaffold, test, script, and generated
  non-goal paths stay out of the package artifact.
- `scripts/check-package-consumer.ts` packs the package, installs the tarball into a
  temporary ESM consumer project, then verifies public root and subpath exports with
  runtime imports and TypeScript declaration resolution.
- `scripts/check-public-api-docs.ts` compares the documented public export
  inventory with actual package `index.ts` named exports.
- `tsconfig.build.json` emits package JavaScript and declarations under ignored
  `dist/`.
- The root `package.json` `files` allowlist is the artifact boundary. It includes
  compiled `dist` entrypoints, internal package manifests, license/security/readme
  files, and consumer-facing docs only.
- The `contract` runner executes the live-looking secret guard, package surface
  guard, public API documentation guard, dry-run artifact guard, and packed
  consumer import guard.

## Review Blockers

- Public exports change without semver and migration notes.
- Compatibility claims lack runtime or consumer evidence.
- Package artifacts drift from documented public API.
- Package files include fixtures with real-looking secrets that could be mistaken for
  live credentials.
