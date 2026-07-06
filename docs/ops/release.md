# Release

Status: Active

## Operational Contract

Releases ship a package. They do not deploy a service. Versioning and migration
rules follow docs/library/semver.md and docs/library/migration-guide.md.

## Pre-Release Checklist

- test, docs, and check validations pass or skipped risk is explicit.
- Public API and SDK docs match package behavior.
- Detector default changes have fixtures and migration notes.
- Examples use synthetic values only.
- `capture_content: false` remains the default.
- No release artifact includes raw GenAI content or live-looking secrets.

## Stop Conditions

- Unsafe content export by default.
- Redaction failure exports content.
- Detector default changes lack evidence.
- Package surface changes lack semver or migration notes.
