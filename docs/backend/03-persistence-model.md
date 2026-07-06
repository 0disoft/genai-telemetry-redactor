# Persistence Model

Status: Active

## Boundary

The package has no database, prompt store, telemetry store, or migration stream.
Redaction should happen in memory before callers export telemetry.

## Data Handling

- Raw prompts, completions, tool arguments, credentials, and customer identifiers
  are caller-owned.
- Redaction results and summaries may be returned to callers, but must not
  require repository-owned persistence.
- Fixtures must use synthetic values only.

## Merge Blockers

- A change adds storage for raw content without a product decision and ADR.
- DBML or migration placeholders are treated as implemented persistence.
- Redaction summaries encode original values in a reversible or searchable way.
