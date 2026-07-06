# Quality Attributes

Status: Active

## Security

- Raw prompt, completion, tool argument, bearer token, API key, private URL, and
  customer identifier values must not appear in telemetry by default.
- Redaction failure must fail closed for content export.
- Documentation and tests must use fake values that cannot be confused with live
  credentials or private customer data.

## Correctness

- Detector behavior must be fixture-backed.
- False positives and false negatives must be tracked as product risks.
- Provider request/response shape support must be explicit.
- OTel GenAI convention mapping must name the expected fields and version when
  the version is chosen.

## Compatibility

- Public API changes require semver and migration notes.
- Detector default changes are behavior changes, even when function signatures
  stay stable.
- SDK examples must stay aligned with documented exports.

## Operability

- Redaction summaries should preserve useful debugging signals without raw
  content.
- Safe error metadata is allowed; raw error context is not.
- Sampling and content-capture policy must be visible to consumers.
