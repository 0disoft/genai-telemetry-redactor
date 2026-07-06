# Backend

Status: Product-shaping

## Backend Contract

This repository is scaffolded with backend documents, but the current product is a
library/SDK, not a hosted backend service.

Backend-facing ownership means safe server-side integration with model clients and
telemetry writers. The active backend contract is redaction before telemetry export,
not API routing, auth, or persistence.

## Required Decisions

- API owner: not applicable until a hosted adapter is intentionally introduced.
- Auth model: caller-owned.
- Authorization checks: caller-owned.
- Persistence model: no raw prompt, completion, tool argument, or telemetry content
  persistence.
- Error response policy: library warnings and errors must not expose raw content.

## Merge Blockers

- A change treats parked OpenAPI or DB placeholders as active product surface.
- A change stores raw GenAI content in logs, spans, test fixtures, examples, or
  persistence.
- A hosted API, DB, queue, or worker is added without a new ADR and source-of-truth
  update.
