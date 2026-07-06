# Development

Status: Active

## Development Contract

Development should stay documentation-first until implementation choices are
made. The known product shape is a TypeScript-oriented library/SDK wrapper for
redacting GenAI telemetry content before export; exact runtime, package manager,
and OpenTelemetry dependency versions remain implementation decisions.

## Before Changing Code

- Confirm the relevant product, library, SDK, security, and ADR source of truth.
- Keep public behavior aligned with docs.
- Add or update fixture coverage for detector, policy, mapping, and failure
  behavior.
- Use only synthetic examples that cannot be mistaken for real secrets or
  customer data.

## Validation

Stable validation names are defined in VALIDATION.md. If a runner is not yet
configured for `test`, `docs`, or `check`, report the validation as skipped with
the reason and remaining risk.

## Review Blockers

- Raw content is logged before redaction.
- Redaction failure exports content-bearing fields.
- `capture_content` defaults to true.
- Provider shape support is added without tests.
- Placeholder API or DB files become de facto product contracts.
