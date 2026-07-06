# Remove Hosted API and DB Placeholders

Status: Accepted

## Context

Root-level `api/` and `db/` directories made the repository look like a hosted
service even though the product boundary is a library and SDK middleware.

## Decision

Move backend placeholders under `docs/non-goals/backend-placeholders/` and keep
them out of source-of-truth routing. They document non-goals, not active product
contracts.

## Consequences

- Repository shape now matches the library/SDK identity more clearly.
- Future hosted API or database work needs a new ADR.
- `ssealed doctor` will continue to report scaffold drift after intentional
  customization.
