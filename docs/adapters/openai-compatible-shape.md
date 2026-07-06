# OpenAI-Compatible Shape

Status: Product-shaping

## Contract

The first adapter targets OpenAI-compatible request and response shapes without
depending on a provider SDK. It should use structural handling and explicitly
warn on unsupported shapes.

## Content-Bearing Areas

- Prompt and message content.
- Completion and response text.
- Tool call names only when caller policy marks them content-bearing.
- Tool call function arguments and nested argument payloads.
- Streaming chunks only as metadata-only until streaming redaction is proven.

## Unknown Shape Policy

Unknown or unsupported shapes must not be assumed safe. The adapter should omit
content-bearing telemetry and emit a safe warning such as
`unsupported_provider_shape`.

## Review Blockers

- A provider SDK becomes a required dependency for the core redaction path.
- Unknown shape handling exports raw content.
- Streaming chunks are exported before buffer and chunk-boundary fixtures exist.
