# Code Review Checklist

Status: Active

## Contract

Code review should block redaction drift, unsafe examples, untested provider
shape support, hidden content export, and package API changes without migration
notes.

## Checklist

- Source-of-truth docs are updated when public behavior changes.
- `capture_content: false` remains the default.
- Redaction runs before telemetry export.
- Failure paths do not include raw content in logs, errors, spans, events, or
  summaries.
- Detector behavior has fixture evidence.
- Provider-shape support is named and tested.
- SDK examples use documented exports and fake values only.
- Semver and migration docs are updated for public API or default changes.

## Review Blockers

- Raw sensitive content appears anywhere in the diff.
- Validation is skipped without a reason and remaining risk.
- Generated output is treated as source truth.
- Placeholder API, DB, or ops docs become active contracts accidentally.
