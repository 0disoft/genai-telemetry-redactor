# Data Integrity

Status: Active

## Contract

Data integrity means redacted output, summaries, and metadata must faithfully
represent what happened without preserving raw sensitive content.

## Integrity Rules

- Replacement tokens must not encode the original secret.
- Redaction counts must match detector matches after policy decisions.
- Reason labels must be stable enough for tests and telemetry dashboards.
- Tool argument redaction must preserve object shape when possible while
  replacing sensitive leaf values.
- Safe metadata must stay separate from content-bearing fields.
- Redaction failure must not produce partial content export.

## Non-Goals

- The package does not guarantee complete PII discovery.
- The package does not store prompts, completions, or tool arguments.
- The package does not own a database, migration stream, or telemetry backend.

## Review Blockers

- Summaries include original values or reversible encodings.
- Counts can drift from actual replacement behavior.
- Nested tool arguments are flattened in a way that hides where redaction
  happened without a documented reason.
