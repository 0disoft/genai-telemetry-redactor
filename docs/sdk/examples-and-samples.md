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

## Executable Examples

- `examples/openai-compatible-basic.ts`: wraps an OpenAI-compatible request and
  response with `withRedactedTelemetry`, verifies fake email, URL, and API-key-like
  content are removed, and checks content capture stays disabled.
- `examples/custom-detector.ts`: registers a caller-owned customer-id detector with
  `createRegexDetector` while keeping built-in detectors active, then verifies custom
  and built-in reason counts.
- `examples/reusable-redaction-profile.ts`: creates a validated custom-only core
  profile and reuses it across independent text redaction operations without
  per-call policy overrides.
- `examples/sdk-reusable-redaction-profile.ts`: passes one validated built-in
  detector profile through `withRedactedTelemetry` and verifies the SDK returns
  only redacted payloads and safe telemetry metadata.
- `examples/buffered-stream-redaction.ts`: uses the provider-agnostic buffered
  stream redactor to handle fake sensitive text split across chunk boundaries
  without returning intermediate content.
- `examples/streaming-metadata-only.ts`: passes a fake streaming chunk to the
  OpenAI-compatible streaming helper and verifies only metadata plus
  `streaming_content_omitted` are returned.

These examples are imported by `scripts/check-examples.ts` after `pnpm run build`.
The `contract` runner executes that check so sample drift fails before publishing.

## Review Blockers

- SDK examples drift from public API.
- Compatibility claims lack runtime or consumer evidence.
- Example inputs look like live production identifiers.
