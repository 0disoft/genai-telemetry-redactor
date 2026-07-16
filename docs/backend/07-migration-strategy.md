# Migration Strategy

Status: Active

## Boundary

There are no database migrations for the current product. Migration strategy
means consumer-facing package migration: API changes, detector defaults,
replacement token format changes, and telemetry mapping changes.

## Migration Requirements

- Public API changes must follow docs/library/semver.md.
- Detector default changes need before/after examples with synthetic data.
- Replacement token changes need migration notes because dashboards may rely on
  reason labels and counts.
- OpenTelemetry GenAI mapping changes must call out convention-version impact.

## Automated Migration Gate

`pnpm run migration-check` compares the current package with
`scripts/migration-baseline.json`. The baseline covers package exports, public API
inventory fingerprints, runtime floor, default detectors, replacement tokens,
warning codes, and the pinned OpenTelemetry GenAI commit. Its version must match
`package.json`, its previous version must match the N-1 compatibility baseline,
and the migration guide must contain a substantive section for that version.

## Merge Blockers

- A behavior change lacks migration notes.
- Detector defaults change without fixture evidence.
- A migration guide encourages exporting raw content to compare old and new
  behavior.
