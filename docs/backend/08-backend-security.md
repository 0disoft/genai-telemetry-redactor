# Backend Security

Status: Product-shaping

## Backend Contract

Backend security for this repository is redaction-library security: untrusted text and
tool arguments enter the library, and only sanitized outputs may leave for telemetry.

## Required Decisions

- API owner: not applicable for the current library.
- Auth model: caller-owned.
- Authorization checks: caller-owned.
- Persistence model: raw content persistence is out of scope.
- Error response policy: errors and warnings must use categories and paths, not raw
  matched values.

## Merge Blockers

- Detector failures pass raw content into telemetry.
- Custom detectors can throw and bypass fail-closed behavior.
- Logs, spans, errors, fixtures, or examples include live-looking secrets.
- The library claims compliance or complete PII detection.
