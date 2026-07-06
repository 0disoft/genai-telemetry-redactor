# CI

Status: Active

## Operational Contract

CI should prove package safety before release. Exact runner implementation is
not selected yet, but stable validation names are defined in VALIDATION.md.

## Required Gates

- test: detector, policy, mapping, failure, and SDK behavior.
- docs: source-of-truth docs and examples remain aligned.
- check: repository-level safety and hygiene checks.

## Artifact Policy

CI artifacts must not include raw prompts, completions, tool arguments, bearer
tokens, API keys, private URLs, or customer identifiers.

## Validation

- Release blocker status: failing tests, unsafe examples, or unreviewed detector
  default changes block release.
- Remaining operational risk: until CI is configured, skipped validation must be
  reported with explicit risk.
