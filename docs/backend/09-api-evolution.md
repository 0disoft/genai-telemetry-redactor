# API Evolution

Status: Active

## Boundary

API evolution refers to library and SDK public APIs, not HTTP routes. Package
exports, option names, detector hooks, result shapes, and telemetry mapping
helpers are the active API surface.

## Evolution Rules

- Preserve `capture_content: false` as the default.
- Keep detector output and redaction summaries stable unless semver and
  migration notes say otherwise.
- Add provider-shape support explicitly; do not silently treat all providers as
  OpenAI-compatible.
- Keep examples aligned with docs/sdk/public-api.md and
  docs/library/public-api.md.

## Merge Blockers

- Public behavior changes without semver guidance.
- SDK examples call undocumented exports.
- API evolution claims complete DLP, PII, or compliance coverage.
