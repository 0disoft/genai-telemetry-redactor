# Incident Response

Status: Active

## Package Incidents

Treat these as package incidents:

- Raw content is emitted by default.
- Redaction failure does not fail closed.
- A detector false negative affects a documented supported pattern.
- A fixture, example, or release artifact includes live-looking sensitive data.

## First Response

- Do not copy raw sensitive content into issues, logs, or postmortems.
- Reproduce with synthetic equivalent data.
- Identify affected package versions and documented provider shapes.
- Add a regression fixture before or with the fix.

## Validation

- Required validation names: test, docs, check.
- Release blocker status: unresolved raw-content export defects block release.
- Remaining operational risk: consumers own provider, telemetry backend, and
  retention incident handling.
