# Backend Data Integrity

Status: Product-shaping

## Backend Contract

Data integrity for this repository means preserving the relationship between input
content, sanitized output, redaction counts, detector reason codes, warnings, and safe
telemetry metadata without storing raw content.

## Required Decisions

- API owner: not applicable.
- Auth model: caller-owned.
- Authorization checks: caller-owned.
- Persistence model: none for raw content; fixture data must be fake.
- Error response policy: warnings must identify category/path without exposing value.

## Merge Blockers

- Redaction reports cannot be reconciled with sanitized output.
- Streaming chunk handling drops warning state or double-counts redactions without
  documentation.
- Detector reason codes change without fixture updates.
