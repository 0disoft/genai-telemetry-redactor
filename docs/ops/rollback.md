# Rollback

Status: Active

## Boundary

Rollback means consumers pin or downgrade the package version. There is no
database rollback policy for the current product.

## Rollback Triggers

- Content capture defaults change unsafely.
- A release exports content when redaction fails.
- A detector regression creates known false negatives.
- SDK wrapper behavior logs raw content before redaction.

## Forward-Fix Criteria

- Regression fixture added.
- Docs describe affected behavior without raw sensitive content.
- Migration notes tell consumers whether to pin, upgrade, or change
  configuration.

## Validation

- Required validation names: test, docs, check.
- Remaining operational risk: consumers own cleanup of any already-exported
  telemetry.
