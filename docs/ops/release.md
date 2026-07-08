# Release

Status: Active

## Operational Contract

Releases ship a package. They do not deploy a service. Versioning and migration
rules follow docs/library/semver.md and docs/library/migration-guide.md.

## Pre-Release Checklist

- test, docs, and check validations pass or skipped risk is explicit.
- Public API and SDK docs match package behavior.
- LICENSE is Apache-2.0 and package metadata reflects it before package release.
- SECURITY.md exists and public issue guidance forbids raw sensitive examples.
- Detector default changes have fixtures and migration notes.
- Examples use synthetic values only.
- `capture_content: false` remains the default.
- No release artifact includes raw GenAI content or live-looking secrets.
- Runtime, license, package name, and publishing requirements are reflected in
  ADRs before release workflow files are added.
- `pnpm run release-readiness` passes before any npm publish attempt.

## Published Release Evidence

- `v0.1.8` was published on 2026-07-08.
- npm package version: `genai-telemetry-redactor@0.1.8`.
- npm integrity:
  `sha512-1eGaZUiAgwJOXEyO9tjYOdFl+8aQrFiypOuGqjrT9ncE+N2ZN9szpGopYIVpOZxNTTFAi2OoYRyN9EAVNpVW9g==`.
- GitHub release: https://github.com/0disoft/genai-telemetry-redactor/releases/tag/v0.1.8.
- Release workflow: GitHub Actions `Release` run `28931239476` completed successfully for tag
  `v0.1.8`.

## Stop Conditions

- Unsafe content export by default.
- Redaction failure exports content.
- Detector default changes lack evidence.
- Package surface changes lack semver or migration notes.
- Publishing relies on long-lived credentials without an ADR-backed reason.
- `pnpm run release-readiness` reports unresolved blockers.
