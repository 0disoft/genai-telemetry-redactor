# OpenTelemetry GenAI Mapping Version Policy

Status: Proposed

## Context

OpenTelemetry GenAI semantic conventions can change. Mapping drift can silently
break dashboards or leak fields if raw and safe metadata boundaries are not
explicit.

## Proposed Direction

The mapper must carry an explicit convention or mapper version label once
implementation chooses a target. Until then, exact convention version remains
UNDECIDED.

## Review Blockers

- Mapper APIs accept raw provider payloads.
- Mapping docs omit version assumptions.
- A mapping change lacks migration notes.
