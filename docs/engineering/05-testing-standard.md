# Testing Standard

Status: Active

## Contract

Testing must prove that the package removes sensitive content before telemetry
export while preserving safe GenAI metadata and useful redaction summaries.

## Required Evidence

- Source of truth: docs/product/02-spec.md, docs/library/public-api.md, and
  docs/sdk/public-api.md.
- Merge-blocking validation names: test, docs, check.
- Related checklists: .agents/checklists/library-package.md and
  .agents/checklists/sdk.md.

## Required Test Areas

- Detector corpus for email, bearer token, API-key-like string, URL, and custom
  detector hooks.
- Replacement token policy and redaction reason counts.
- `capture_content: false` default behavior.
- Fail-closed behavior when redaction or mapping fails.
- Tool argument redaction for nested objects.
- OpenAI-compatible request and response shape handling.
- OpenTelemetry GenAI metadata mapping.
- Streaming content policy, especially chunk-boundary false negatives.
- Synthetic fixture safety and no-live-secret repository scanning.

## Review Blockers

- Tests or examples use live-looking secrets, private URLs, or customer content.
- Detector default changes lack fixture evidence and migration notes.
- Content export behavior changes without explicit `capture_content` coverage.
- A skipped test, docs, or check validation lacks a reason and remaining risk.
- Streaming content export lacks chunk-boundary fixtures and fail-closed evidence.
