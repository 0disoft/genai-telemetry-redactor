# Development

Status: Active

## Development Contract

Development follows the documented TypeScript library and SDK contracts. Node.js
`>=22.14.0` is the consumer runtime, pnpm `11.7.0` owns the workspace, and Bun is
used only by bounded cross-platform validation scripts where documented. The OTel
mapper remains SDK-free and pins its upstream semantic-convention provenance.

## Before Changing Code

- Confirm the relevant product, library, SDK, security, and ADR source of truth.
- Keep public behavior aligned with docs.
- Add or update fixture coverage for detector, policy, mapping, and failure
  behavior.
- Use only synthetic examples that cannot be mistaken for real secrets or
  customer data.

## Validation

Stable validation names are defined in VALIDATION.md. `check` covers formatting,
types, tests, package contracts, migration alignment, coarse performance budgets,
and docs safety. Networked compatibility and OTel drift checks remain explicit
separate validations.

## Review Blockers

- Raw content is logged before redaction.
- Redaction failure exports content-bearing fields.
- `capture_content` defaults to true.
- Provider shape support is added without tests.
- Placeholder API or DB files become de facto product contracts.
