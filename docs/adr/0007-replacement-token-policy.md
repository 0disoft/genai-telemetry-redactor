# Replacement Token Policy

Status: Accepted

## Context

Replacement values need to preserve enough category information for debugging
without preserving the secret itself.

## Decision

Replacement tokens preserve detector category only. Defaults must not preserve
original length, prefix, suffix, hash, stable fingerprint, or reversible
encoding.

## Consequences

- Debugging loses some correlation information.
- Telemetry becomes less useful for joining repeated secrets, which is a feature
  for privacy.
- Token format changes require migration notes once released.
