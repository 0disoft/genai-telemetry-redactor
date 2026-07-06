# Examples and Samples

Status: Product-shaping
Repository Type: sdk

## Repository Type Contract

This repository type owns public API, compatibility, examples, versioning, and consumer migration.

## Source of Truth

- Product decision: examples must demonstrate safe telemetry without real secrets.
- Technical owner: repository owner
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- SDK ownership boundary: examples cover wrappers and adapters only.
- SDK public contract: examples must use documented detector, policy, result, and
  mapper APIs.
- SDK validation evidence: samples should have matching fixture expectations.
- SDK release or rollout policy: samples cannot rely on unreleased exports.
- SDK compatibility and migration policy: examples should show migration when defaults
  change.

## Sample Data Rules

- Use fake placeholders such as `sk_test_example`, `user@example.invalid`, and
  `https://internal.example.invalid/path`.
- Never paste live API keys, customer text, emails, internal URLs, bearer tokens, or
  model-provider responses.
- Include expected redaction categories and counts when showing output.

## Review Blockers

- SDK examples drift from public API.
- Compatibility claims lack runtime or consumer evidence.
- Example inputs look like live production identifiers.
