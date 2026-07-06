# Disaster Recovery

Status: Active

## Boundary

There is no package-owned production runtime to recover. Disaster recovery for
telemetry backends and exported data is consumer-owned.

## Package Disaster Cases

- A detector false negative causes sensitive content export.
- A release changes defaults and enables content capture unexpectedly.
- A provider-shape change leaves new fields unredacted.
- A sample or fixture accidentally includes live-looking sensitive data.

## Response

- Stop promoting the affected version.
- Publish a safe migration or patch release.
- Document affected behavior without repeating raw sensitive content.
- Add regression fixtures for the failure class.

## Validation

- Required validation names: test, docs, check.
- Remaining operational risk: consumers own deletion or retention work in their
  telemetry systems.
