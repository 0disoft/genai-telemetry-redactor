# Fail-Closed Content Export

Status: Accepted

## Context

The project exists to reduce telemetry leakage. Partial success cannot be
treated as safe when any detector, traversal, serialization, or mapping step
fails before content export.

## Decision

If redaction cannot be completed with confidence, omit content-bearing telemetry
and emit only safe metadata plus warning/error codes.

## Consequences

- Consumers may lose debugging detail in failure cases.
- Safety wins over observability value.
- Tests must cover detector throw, traversal limits, unsupported shapes,
  streaming omission, and mapping failures.
