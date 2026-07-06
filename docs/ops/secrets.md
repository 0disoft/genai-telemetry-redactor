# Secrets

Status: Active

## Operational Contract

The repository must not require project secrets for documentation or scaffold
work. Runtime consumers may pass provider credentials through their own code,
but this package must never ask contributors to store those credentials in this
repository.

## Secret-Like Content

Treat these as sensitive even in tests and docs:

- Bearer tokens.
- API-key-like strings.
- Private or internal URLs.
- Customer identifiers.
- Raw prompt, completion, and tool argument content.

## Allowed Test Values

Use clearly fake values such as `token_example`, `key_example`, and
`https://example.invalid/path`. Do not use values that look copy-pasted from a
real provider dashboard.

## Validation

- Required validation names: test, docs, check.
- Release blocker status: no live-looking secrets in examples, fixtures, logs,
  errors, or generated documentation.
- Remaining operational risk: realistic test corpora are needed, but they must
  be synthetic and safe.
