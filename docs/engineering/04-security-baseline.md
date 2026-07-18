# Security Baseline

Status: Product-shaping

## Contract

Security baseline covers redaction behavior, detector policy, input validation,
output validation, safe telemetry mapping, secrets, sample data, logs, and security
blockers.

## Required Evidence

- Source of truth: docs/product/02-spec.md, docs/library/public-api.md,
  docs/sdk/public-api.md, docs/backend/06-logging-and-observability.md
- Owner: repository owner
- Merge-blocking validation: VALIDATION.md
- Related checklist: CHECKLIST.md

## Review Blockers

- A change bypasses the redaction policy source of truth.
- A change weakens default redaction or enables content capture by default.
- A change hides skipped detector, streaming, nested-object, or provider-shape checks.
- A rolling stream accepts custom detectors or flushes an unbounded match behind
  a guessed fixed holdback length.
- A change adds examples, fixtures, logs, or telemetry with live-looking secrets or
  private identifiers.
- A change claims complete PII/DLP/compliance coverage.
- A change adds or recommends custom regex detectors without considering
  `docs/security/custom-regex-redos-guidance.md`.
