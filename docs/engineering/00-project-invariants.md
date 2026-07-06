# Project Invariants

Status: Active

## Contract

These invariants must remain true across implementation, tests, docs,
configuration, examples, and releases.

## Invariants

- `capture_content` defaults to false.
- Redaction happens before content-bearing telemetry export.
- Redaction failure fails closed for content export.
- The package does not claim complete DLP, PII, or compliance coverage.
- The package does not own a telemetry backend, prompt store, model gateway,
  hosted API server, database, or migration stream.
- Examples and fixtures use synthetic values only.
- Detector behavior and provider-shape support are fixture-backed.

## Required Evidence

- Source of truth: docs/product/02-spec.md and docs/adr/*.md.
- Merge-blocking validation names: test, docs, check.
- Related checklists: .agents/checklists/library-package.md and
  .agents/checklists/sdk.md.

## Review Blockers

- A change violates any invariant without an ADR.
- A change weakens validation or hides skipped checks.
- A change adds raw sensitive content to docs, fixtures, logs, or telemetry
  examples.
