# Operability and Failure Standard

Status: Active

## Contract

The package is not an operated service, but consumers will rely on its failure
behavior inside production telemetry paths.

## Failure Requirements

- Redaction failure must fail closed for content export.
- Safe metadata may report that redaction failed.
- Errors must identify failure class without echoing raw content.
- Unsupported provider shapes should be explicit and testable.
- Streaming content must not be exported until streaming redaction behavior is
  proven.

## Release Evidence

- test, docs, and check validations or explicit skipped reasons.
- Fixture evidence for detector and mapping changes.
- Migration notes for public API or default behavior changes.
- Clear remaining risk for false negatives and provider shape drift.

## Review Blockers

- Failure paths leak content.
- A change relies on consumers noticing unsafe defaults.
- Incident guidance tells users to inspect raw telemetry content.
