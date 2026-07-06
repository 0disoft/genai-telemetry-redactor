# Authentication

Status: Active

## Boundary

This repository does not own user authentication, provider authentication, API
keys, OAuth flows, sessions, or tenant identity. Consumers authenticate with LLM
providers and telemetry systems in their own applications.

## Library Requirements

- Do not require credentials for local docs, examples, or fixture tests.
- Treat bearer tokens and API-key-like strings as redaction targets.
- Do not echo provider credentials in errors, telemetry summaries, logs, or
  examples.
- SDK wrappers must pass through caller-owned provider configuration without
  storing or documenting real values.

## Merge Blockers

- A sample contains a live-looking API key, bearer token, or provider credential.
- The package stores credentials or asks contributors to commit them.
- Error handling reveals an authentication secret while reporting provider
  failures.
