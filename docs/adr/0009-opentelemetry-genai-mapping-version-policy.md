# OpenTelemetry GenAI Mapping Version Policy

Status: Accepted

## Context

OpenTelemetry GenAI semantic conventions can change. Mapping drift can silently
break dashboards or leak fields if raw and safe metadata boundaries are not
explicit.

## Decision

The mapper records the upstream OpenTelemetry GenAI semantic-convention source
as Development, not stable. The default mapper label is
`opentelemetry-semconv-genai-main`, the status is `development`, and the source
URL is `https://github.com/open-telemetry/semantic-conventions-genai`.

This label is a mapping provenance marker, not a compatibility promise that the
upstream convention is stable. Callers may pass a safe override label through
the mapper options when they pin a stricter local convention source.

Library-specific redaction, warning, content-capture, and mapper metadata stay
under `genai_redactor.*`. Official `gen_ai.*` attributes are used only for safe
metadata fields covered by the upstream GenAI convention.

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
