# Security Policy

## Scope

This repository is pre-implementation documentation for a GenAI telemetry
redaction library and SDK. It is not a hosted service, DLP platform, prompt
store, model gateway, or compliance product.

## Reporting

Do not include raw prompts, completions, tool arguments, provider credentials,
API keys, bearer tokens, private URLs, customer identifiers, or production
telemetry exports in public issues or pull requests.

Until a private security contact is published, open a minimal public issue that
describes the affected behavior using synthetic examples only and asks for a
private reporting channel.

## Fixture Policy

Security reproductions must use synthetic data. Public fixtures, examples,
snapshots, and documentation must not contain live-looking secrets or copied
customer content.

## Non-Guarantee

This project can reduce telemetry leakage risk, but it cannot guarantee complete
PII discovery, DLP coverage, or legal compliance.
