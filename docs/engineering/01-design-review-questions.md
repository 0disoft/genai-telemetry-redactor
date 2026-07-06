# Design Review Questions

Status: Active

## Contract

Design review must force each change through the privacy boundary before
implementation starts.

## Questions

- Which content-bearing fields can this change see?
- Can any raw prompt, completion, tool argument, token, key, URL, or customer
  identifier reach telemetry before redaction?
- What happens when redaction fails?
- Does the change alter detector defaults, replacement token format, or reason
  labels?
- Does the change assume a provider shape beyond OpenAI-compatible requests and
  responses?
- Does the change require a new OpenTelemetry GenAI convention version decision?
- Is streaming content involved, and how are chunk boundaries handled?
- Are examples and fixtures synthetic and safe?

## Review Blockers

- The design cannot explain fail-closed content export.
- The design treats redaction as complete DLP or compliance proof.
- The design expands service, storage, or gateway ownership without an ADR.
