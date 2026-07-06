# Replacement Token Policy

Status: Product-shaping

## Contract

Replacement tokens preserve category and debugging value without preserving the
original sensitive value.

## Default Shape

Use category-only tokens such as:

- `[REDACTED:email]`
- `[REDACTED:api_key]`
- `[REDACTED:bearer_token]`
- `[REDACTED:url]`
- `[REDACTED:custom:<reason>]`

## Forbidden Defaults

- Original value length.
- Prefix or suffix.
- Hashes or stable fingerprints.
- Provider credential fragments.
- Customer identifiers or business-domain paths.

## Review Blockers

- Replacement output can be used to reconstruct or correlate the original value.
- Token format changes lack migration notes.
- Examples use realistic secrets to demonstrate replacement.
