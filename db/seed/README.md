# Seed Data

Status: Inactive

## Boundary

The current product has no owned database and no seed-data workflow. Test data
belongs in synthetic fixtures for detector, policy, SDK, and telemetry mapping
behavior.

## Allowed Fixture Style

- Use fake values only.
- Prefer `.invalid` domains and obvious placeholders.
- Do not include real prompts, completions, tool arguments, bearer tokens, API
  keys, private URLs, or customer identifiers.

## Review Blockers

- Seed files are added without an ADR introducing persistence.
- Seed or fixture data looks like copied production content.
- Test data teaches consumers to store raw GenAI content.
