# CI

Status: Active

## Operational Contract

CI proves package safety before release with GitHub Actions. The workflow is
`.github/workflows/ci.yml` and it runs on pull requests and pushes to `main`.
The workflow uses Node.js `22.14.0` and `24.x`, pnpm `11.7.0`, and read-only
repository permissions.

## Required Gates

- test: detector, policy, mapping, failure, and SDK behavior.
- docs: source-of-truth docs and examples remain aligned.
- check: repository-level safety and hygiene checks.
- smoke: focused package behavior checks for core redaction, adapters, OTel
  mapping, and SDK wrapper behavior.
- migration-check: package contract, version, N-1 baseline, and migration-guide
  alignment.
- performance: broad median and p95 ceilings for synthetic hot-path workloads.
- otel-semconv-drift: scheduled advisory comparison against upstream `main`; it
  can write only a deduplicated review issue and cannot change repository content.

## Artifact Policy

CI artifacts must not include raw prompts, completions, tool arguments, bearer
tokens, API keys, private URLs, or customer identifiers.

## Validation

- Release blocker status: failing tests, unsafe examples, or unreviewed detector
  default changes block release.
- Remaining operational risk: CI validates the package and docs, but does not
  publish npm artifacts or deploy services.
