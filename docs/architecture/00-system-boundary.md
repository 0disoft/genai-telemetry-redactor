# System Boundary

Status: Active

## Boundary

This repository owns a GenAI telemetry redaction library and SDK middleware
contract. It consumes caller-provided LLM request/response shapes and emits
redacted content, redaction summaries, and safe OpenTelemetry GenAI metadata.

## Owned Components

- Redaction policy and detector contracts.
- Replacement token formatting.
- Redaction result and summary metadata.
- OpenTelemetry GenAI mapping helpers.
- SDK wrapper and middleware integration guidance.

## External Components

- LLM providers and provider SDKs.
- OpenTelemetry SDKs, collectors, and telemetry backends.
- Application logging, tracing, and sampling configuration.
- Caller-owned auth, tenant, storage, and deployment systems.

## Non-Product Surfaces

The parked OpenAPI and DB files under `docs/non-goals/backend-placeholders/` are
repository scaffolding only. They do not describe an active service, persistence
model, or migration stream.

## Quality Attributes

- Security: raw GenAI content must not be exported unless the caller explicitly
  enables content capture and redaction succeeds.
- Maintainability: detector and SDK changes must preserve source-of-truth docs.
- Compatibility: provider-shape and OTel convention drift must be explicit.
- Operability: failures must prefer safe metadata over raw-content leakage.
