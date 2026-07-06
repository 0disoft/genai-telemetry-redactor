# Backend Placeholders

Status: Inactive

## Purpose

This directory parks scaffold files that would otherwise make the repository look
like a hosted API or database-backed service. They are retained only as explicit
non-goal evidence.

## Boundary

- `api/`: inactive OpenAPI placeholder and example response shapes.
- `db/`: inactive DBML, migration, and seed placeholders.

## Review Blockers

- A parked file is cited as active product behavior.
- A hosted API, DB, migration stream, worker, or prompt store is added without a
  new ADR.
- Parked examples include raw GenAI content or live-looking secrets.
