# Operational Contract

Status: Active

## Boundary

This repository ships a package, not an operated service. It does not own SLOs,
RTO, RPO, dashboards, collectors, or telemetry retention for consuming
applications.

## Operational Priorities

- Keep content capture off by default.
- Fail closed for content export when redaction fails.
- Preserve safe redaction summaries for debugging.
- Avoid dependencies that create network, storage, or logging side effects.
- Make detector false-negative and provider-shape drift risks visible.

## Validation

- Required validation names: test, docs, check.
- Release blocker status: unsafe content export, live-looking examples, or
  untested detector defaults block release.
- Remaining operational risk: consumers still own provider credentials,
  telemetry exporters, retention, and incident response.
