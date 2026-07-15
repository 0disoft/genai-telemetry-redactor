# OpenTelemetry GenAI Mapping Version Policy

Status: Accepted

## Context

OpenTelemetry GenAI semantic conventions can change. Mapping drift can silently
break dashboards or leak fields if raw and safe metadata boundaries are not
explicit.

## Decision

The mapper records the upstream OpenTelemetry GenAI semantic-convention source
as Development, not stable. The default mapper label is
`opentelemetry-semconv-genai-93a59e48a9b4`, the status is `development`, and the
source URL pins commit `93a59e48a9b4ea162a4d76edac4ace2d415a759e` in
`open-telemetry/semantic-conventions-genai`.

This label is a mapping provenance marker, not a compatibility promise that the
upstream convention is stable. Callers may pass a safe local display-label
override through the mapper options; the emitted source still identifies the
upstream snapshot implemented by this package.

Library-specific redaction, warning, content-capture, and mapper metadata stay
under `genai_redactor.*`. Official `gen_ai.*` attributes are used only for safe
metadata fields covered by the upstream GenAI convention.

The pinned snapshot defines input and output token counts as integers and does
not define `gen_ai.usage.total_tokens`. Invalid token counts are dropped, while a
valid caller-provided total remains available under
`genai_redactor.usage.total_tokens`.

## Consequences

- Mapping output remains inspectable when upstream GenAI semantic conventions
  change.
- Changes to the default convention label, exported official attributes, or
  `genai_redactor.*` metadata are release-noted compatibility changes.
- The mapper must continue rejecting raw provider payloads, span writer objects,
  prompts, completions, tool arguments, credentials, and private identifiers.

## Review Blockers

- Mapper APIs accept raw provider payloads.
- Mapping docs omit version assumptions.
- A mapping change lacks migration notes.
