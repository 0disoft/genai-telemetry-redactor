# Error Response

Status: Active

## Boundary

This repository does not currently own a hosted API error-response contract.
Error handling belongs to the library and SDK surfaces: detector failures,
mapping failures, unsupported provider shapes, and unsafe content-export states.

## Error Policy

- Errors must not echo raw prompt, completion, tool argument, bearer token, API
  key, private URL, or customer identifier values.
- Redaction failures must fail closed for content export.
- Unsupported provider shapes should return or throw structured safe errors that
  identify the unsupported shape category, not the raw payload.
- SDK wrappers should let callers handle provider errors without adding raw
  content to telemetry.

## Merge Blockers

- Error messages include unredacted content.
- Failure paths export partial content after redaction fails.
- Parked OpenAPI error examples are treated as an implemented API server.
