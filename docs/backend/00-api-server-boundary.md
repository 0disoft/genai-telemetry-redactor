# API Server Boundary

Status: Product-shaping

## Backend Contract

There is no active hosted API server boundary in the current product.
`docs/non-goals/backend-placeholders/api/openapi.yaml` is a parked placeholder
and must not be treated as an implemented API contract.

If a hosted adapter is introduced later, it needs an ADR that explains why a library
boundary is no longer enough, how auth is owned, and how raw GenAI content is kept out
of request logs and telemetry.

## Required Decisions

- API owner: not applicable.
- Auth model: caller-owned.
- Authorization checks: caller-owned.
- Persistence model: none for the library core.
- Error response policy: do not include raw prompt, completion, tool arguments, tokens,
  private URLs, or customer identifiers in errors.

## Merge Blockers

- API endpoints are added without an ADR and tests for request-log redaction.
- Parked placeholder API examples are cited as implemented behavior.
- API errors leak redaction input or detector match values.
