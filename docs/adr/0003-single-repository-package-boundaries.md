# Single Repository Package Boundaries

Status: Accepted

## Context

The product is small and security-sensitive. Splitting GitHub repositories too
early would create documentation, release, issue, and advisory drift before the
core redaction contract is proven.

## Decision

Keep one GitHub repository. Use internal package boundaries in documentation and
future implementation to separate core redaction, OpenAI-compatible adapters,
OpenTelemetry mapping, and SDK ergonomics.

The first external publishable artifact should be one package unless a future
ADR proves independent package publishing is worth the release overhead.

## Consequences

- Versioning and security advisories stay centralized.
- Internal boundaries must be documented clearly so the repository does not turn
  into a gateway or telemetry backend.
- Future package-manager choice remains an implementation decision.
