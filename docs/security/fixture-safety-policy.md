# Fixture Safety Policy

Status: Active

## Contract

Fixtures, examples, snapshots, docs, and generated artifacts must use synthetic
values only.

## Allowed Style

- `.invalid` domains.
- Obvious placeholders such as `token_example` and `key_example`.
- Fake emails such as `user@example.invalid`.
- Redacted output examples such as `[REDACTED:email]`.

## Forbidden Content

- Real prompts, completions, or tool arguments.
- Real provider responses or telemetry exports.
- Live-looking API keys, bearer tokens, private URLs, or customer identifiers.
- Public PII datasets or copied production logs.

## Review Blockers

- A fixture looks copy-pasted from a provider dashboard or customer log.
- A synthetic value can be mistaken for a real secret.
- A detector improvement requires committing real sensitive examples.
