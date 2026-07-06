# Observability

Status: Active

## Operational Contract

This package helps applications emit safer GenAI telemetry. It is not a
telemetry backend and does not own dashboards, collectors, retention, alerting,
or incident response for consuming applications.

## Package Signals

- Redaction count by reason.
- Content capture enabled or disabled.
- Redaction failure status without raw content.
- Provider shape or mapping support label.
- Safe OpenTelemetry GenAI metadata such as model, operation, token counts,
  latency, and error classification when provided by the caller.

## Forbidden Signals

- Raw prompt or completion text.
- Raw tool argument values.
- Bearer tokens, API keys, private URLs, customer identifiers, or realistic
  secret-looking examples.
- Error messages that echo unredacted content.

## Validation

- Required validation names: test, docs, check.
- Release blocker status: content export defaults to off, redaction failure
  fails closed, and examples stay fake.
- Remaining operational risk: detector false negatives and provider shape drift
  must remain visible risks for consumers.
