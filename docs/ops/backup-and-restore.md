# Backup and Restore

Status: Active

## Boundary

The current product has no repository-owned runtime data store. Backup and
restore for prompts, completions, tool arguments, traces, logs, and telemetry
backends is consumer-owned.

## Package Recovery

Recovery means reverting or replacing a package version that changes redaction
behavior unsafely.

- Keep migration notes for public API and detector default changes.
- Preserve test fixtures that expose detector behavior.
- Prefer forward fixes for false negatives when possible.
- Tell consumers when a release may have exported content unexpectedly.

## Validation

- Required validation names: test, docs, check.
- Release blocker status: no release should require restoring raw prompt data.
- Remaining operational risk: consumers own any telemetry backend cleanup after
  accidental export.
