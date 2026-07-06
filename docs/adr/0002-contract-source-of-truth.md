# Contract Source of Truth

Status: Accepted

## Context

The scaffold originally contained backend-shaped placeholder files because the
repository was initialized with backend scope. Those placeholders are parked
under `docs/non-goals/backend-placeholders/`. The actual product boundary is a
library plus SDK middleware for GenAI telemetry redaction.

## Decision

The source of truth is documentation-first until implementation begins. Contract
priority is:

1. `docs/product/02-spec.md` for product scope, non-goals, and MVP behavior.
2. `docs/library/public-api.md` for library-level public API.
3. `docs/sdk/public-api.md` for SDK middleware and wrapper behavior.
4. `docs/backend/06-logging-and-observability.md` for telemetry safety and
   OpenTelemetry GenAI mapping boundaries.
5. `docs/engineering/04-security-baseline.md` for secret-handling and
   redaction safety requirements.
6. `docs/adr/*.md` for durable architecture decisions.
7. `VALIDATION.md` for stable validation names.

Parked OpenAPI, DBML, migration, and backend API documents are not product
contracts unless a future ADR explicitly expands the repository into a service.

## Drift Rules

- Detector behavior changes require fixture evidence and migration notes when
  defaults change.
- SDK examples must use fake values only and remain aligned with public API
  docs.
- OpenTelemetry GenAI mapping changes must name the convention version or state
  why the version remains undecided.
- Content export behavior must preserve `capture_content: false` as the default.

## Review Blockers

- A change updates parked placeholder API or DB files while leaving public API
  and SDK docs stale.
- A change makes examples look like live credentials, private URLs, or customer
  content.
- A change adds a new public contract without naming validation evidence.
