# ADR Template

Status: Template

## Context

Describe the product, library API, SDK, redaction, telemetry, or safety pressure
that requires a durable decision.

## Decision

State the selected boundary or behavior. Name whether the decision affects
detectors, replacement tokens, OpenTelemetry GenAI mapping, content capture,
streaming redaction, package exports, or SDK adapters.

## Consequences

- Security impact:
- Compatibility impact:
- False-negative or false-positive impact:
- Telemetry semantics impact:
- Migration impact:

## Source of Truth

- Product scope:
- Public API:
- SDK contract:
- Validation evidence:

## Review Blockers

- The decision logs, stores, or documents raw sensitive GenAI content.
- The decision changes detector defaults without migration notes and fixture
  evidence.
- The decision claims complete DLP, PII, or compliance coverage.
- The decision introduces hosted API, database, gateway, or telemetry-backend
  ownership without a new product decision.
