# OpenAI-Compatible Shape

Status: Active

## Contract

The first adapter targets OpenAI-compatible request and response shapes without
depending on a provider SDK. It should use structural handling and explicitly
warn on unsupported shapes.

The implemented surface is a payload adapter, not a provider client wrapper. It
does not own credentials, retries, routing, HTTP transport, span export, or model
gateway behavior.

## Content-Bearing Areas

- Prompt and message content.
- Completion and response text.
- Tool call names only when caller policy marks them content-bearing.
- Tool call function arguments and nested argument payloads.
- Streaming chunks only as metadata-only until streaming redaction is proven.

## Implemented Behavior

- `redactOpenAICompatibleRequest` redacts `messages[].content`, `prompt`, and
  `input`. String content is handled by core text redaction; structured input and
  multimodal content parts are handled by JSON-like traversal.
- `redactOpenAICompatibleResponse` redacts `choices[].text`,
  `choices[].message.content`, `choices[].message.tool_calls`, and nested
  `function.arguments`.
- Tool-call `function.arguments` strings are parsed as JSON when possible,
  redacted through tool-argument traversal, and serialized back to a JSON string.
  Malformed argument strings are redacted as text and return
  `malformed_tool_arguments`.
- Tool names are treated as metadata by default. Callers must opt in with
  `redactToolNames` when their policy treats tool names as content-bearing.
- Request and response helpers accept either inline core redaction options or a
  reusable `{ profile, signal? }` operation. Adapter-only options such as
  `redactToolNames` are separated before the core operation runs and cannot
  override profile policy.
- `redactOpenAICompatibleStreamEvent` omits chunk content and returns only
  metadata with `streaming_content_omitted`.

## Unknown Shape Policy

Unknown or unsupported shapes must not be assumed safe. The adapter should omit
content-bearing telemetry and emit a safe warning such as
`unsupported_provider_shape`.

The implementation fails closed for non-object payloads, missing known request
content fields, missing `choices` response arrays, malformed message arrays,
malformed tool-call arrays, unsupported content-bearing substructures, and
fields outside the adapter's supported allowlist. Response choices must contain
a supported `text` or `message` field; streaming-style `delta` chunks belong on
`redactOpenAICompatibleStreamEvent` and are not exported by the non-streaming
response helper.

Allowlisted metadata fields are preserved only for the supported structural
shape. Unknown top-level provider extensions such as `metadata`, `extra_body`,
or unrecognized choice/message fields fail closed because they may carry prompt,
completion, tool, or customer content.

## Review Blockers

- A provider SDK becomes a required dependency for the core redaction path.
- Unknown shape handling exports raw content.
- Streaming chunks are exported before buffer and chunk-boundary fixtures exist.
