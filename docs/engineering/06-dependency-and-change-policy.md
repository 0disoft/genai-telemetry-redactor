# Dependency and Change Policy

Status: Active

## Contract

Dependencies must earn their place in a privacy-sensitive library. A dependency
that runs on raw prompt, completion, or tool argument content increases both
security and maintenance risk.

## Dependency Review

- Necessity and smaller alternatives.
- License and redistribution fit for an OSS package.
- Maintenance health and vulnerability history.
- Runtime and bundle impact.
- Behavior on untrusted text.
- Whether it can log, phone home, persist, or transform raw content in unsafe
  ways.

## Change Review

- Public API changes require semver and migration notes.
- Detector default changes require fixture evidence.
- OTel mapping changes require convention-version notes.
- SDK wrapper changes require example updates.

## Review Blockers

- A dependency sees raw content without a clear security reason.
- A dependency performs network, storage, telemetry, or logging side effects.
- A major behavior change skips migration guidance.
