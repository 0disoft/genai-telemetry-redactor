# Migrations

Status: Inactive

## Boundary

The current product is a library and SDK middleware package. It does not own a
database or migration stream.

## Source of Truth

- Product scope: ../../../../product/02-spec.md
- Architecture boundary: ../../../../adr/0001-initial-architecture-boundaries.md
- Contract source of truth: ../../../../adr/0002-contract-source-of-truth.md

## Review Blockers

- A migration is added without a product decision that introduces owned
  persistence.
- A migration stores raw prompts, completions, tool arguments, credentials, or
  customer identifiers.
- Placeholder DB files are treated as implemented product behavior.
