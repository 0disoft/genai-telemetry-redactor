# Detector Corpus

Status: Product-shaping

## Contract

Detector behavior must be proven with a synthetic corpus. Corpus files must
demonstrate what categories are tested without becoming a sensitive-data dump.

## Required Coverage

- Positive and negative examples for email, bearer or HTTP auth token,
  API-key-like string including cloud and source-control token shapes, and URL.
- Same-start overlapping detections and different-start partial overlaps.
- Repeated detections.
- Unicode text.
- Long strings and ReDoS-shaped inputs.
- Nested tool arguments.
- Unsupported provider shapes.
- Custom detector success and failure.

## Deterministic Fuzz Invariants

- Generate bounded JSON-like payloads from fixed seeds so failures are locally
  reproducible.
- Require successful redaction results to omit every sensitive input canary from
  values, reports, warnings, and errors.
- Verify redaction does not mutate caller-owned JSON-like input.
- Check every two-chunk split position for buffered streaming content so a
  sensitive value cannot escape only because it crosses a chunk boundary.
- Exercise known OpenAI-compatible request and response variants, and require
  unknown content-bearing shapes to fail closed without echoing input canaries.
- Differentially check the lossless tool-argument parser against `JSON.parse`
  for bounded valid and invalid syntax corpora while asserting unchanged numeric
  lexemes and string escapes remain byte-for-byte stable.
- Exercise the maximum default tool-argument array with every string redacted so
  reconstruction cannot regress to repeated whole-payload copying.
- Keep fuzz fixtures synthetic and compatible with the fixture safety policy.

## Output Assertions

Tests should assert that raw sample values do not appear anywhere in redacted
values, redaction reports, telemetry metadata, warnings, errors, or snapshots.

## Review Blockers

- Corpus changes lack expected redaction reports.
- Snapshot tests replace direct no-leak assertions.
- Corpus examples look like real credentials or customer data.
