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

## Merge Blockers

- A behavior change lacks migration notes.
- Detector defaults change without fixture evidence.
- A migration guide encourages exporting raw content to compare old and new
  behavior.
