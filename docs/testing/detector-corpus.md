# Detector Corpus

Status: Product-shaping

## Contract

Detector behavior must be proven with a synthetic corpus. Corpus files must
demonstrate what categories are tested without becoming a sensitive-data dump.

## Required Coverage

- Positive and negative examples for email, bearer token, API-key-like string,
  and URL.
- Overlapping detections.
- Repeated detections.
- Unicode text.
- Long strings and ReDoS-shaped inputs.
- Nested tool arguments.
- Unsupported provider shapes.
- Custom detector success and failure.

## Output Assertions

Tests should assert that raw sample values do not appear anywhere in redacted
values, redaction reports, telemetry metadata, warnings, errors, or snapshots.

## Review Blockers

- Corpus changes lack expected redaction reports.
- Snapshot tests replace direct no-leak assertions.
- Corpus examples look like real credentials or customer data.
