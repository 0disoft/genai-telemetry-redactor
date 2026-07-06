# SDK Compatibility

Status: Product-shaping
Repository Type: sdk

## Repository Type Contract

This repository type owns public API, compatibility, examples, versioning, and consumer migration.

## Source of Truth

- Product decision: compatibility is proven by adapter fixtures, not provider-name
  claims.
- Technical owner: repository owner
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- SDK ownership boundary: stable wrapper interfaces and adapter contracts.
- SDK public contract: documented wrapper options, detector hooks, result fields, and
  warning codes.
- SDK validation evidence: fixtures for each supported provider payload shape.
- SDK release or rollout policy: adapter support is opt-in until compatibility is
  demonstrated.
- SDK compatibility and migration policy: provider-shape changes must be called out in
  release notes.

## Review Blockers

- SDK examples drift from public API.
- Compatibility claims lack runtime or consumer evidence.
- A provider is listed as supported without request, response, tool-call, and failure
  fixtures.
