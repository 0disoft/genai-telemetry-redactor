# Runtime Flow

Status: Active

## Non-Streaming Flow

1. Caller invokes an LLM provider or SDK wrapper.
2. The integration identifies content-bearing fields and safe metadata fields.
3. If `capture_content` is false, content fields are omitted from telemetry.
4. If `capture_content` is true, detectors inspect prompt, completion, and tool
   argument content before export.
5. The package replaces detected values, records reason counts, and returns a
   redaction summary.
6. Telemetry mapping emits safe OpenTelemetry GenAI attributes and events.

## Streaming Flow

Streaming support must treat chunk boundaries as a security risk. Until a
streaming buffer policy is explicitly implemented and tested, streaming content
must follow the safer behavior: omit raw chunks from telemetry and emit only safe
metadata plus redaction status.

## Failure Flow

If detector execution, serialization, or mapping fails, the package must avoid
exporting content-bearing fields. It may emit safe error metadata that says
redaction failed, but must not include the original content in the error.

## Review Blockers

- Runtime examples log original content before redaction.
- Streaming examples imply chunk-level redaction is safe without tests.
- Failure paths include raw content in thrown errors, spans, logs, or summaries.
