# Service Levels

Status: Active

## Boundary

No hosted service level is promised by this repository. Consumers own runtime
availability, telemetry exporter uptime, storage retention, and incident
response.

## Package Quality Levels

- Safe default: content capture off.
- Safe failure: content export fails closed on redaction failure.
- Useful telemetry: redaction summaries and safe GenAI metadata remain available.
- Explicit compatibility: supported provider shapes and OTel mappings are named.

## Validation

- Required validation names: test, docs, check.
- Release blocker status: unsafe defaults or untested detector changes block
  release.
- Remaining operational risk: no detector corpus can prove complete sensitive
  data coverage.
