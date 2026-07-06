# Authorization

Status: Active

## Boundary

This repository does not own tenant authorization, role checks, policy engines,
or resource permissions. Authorization is caller-owned.

## Library Requirements

- Redaction policy must not depend on hidden tenant or user state.
- Custom detector hooks may be caller-provided, but must not require this package
  to understand the caller's authorization model.
- Telemetry summaries must not include tenant secrets, customer identifiers, or
  permission details.

## Merge Blockers

- A feature implies this package decides whether a user may view or export
  telemetry.
- A redaction summary leaks authorization context or customer identifiers.
- SDK examples mix redaction policy with app-specific tenant authorization.
