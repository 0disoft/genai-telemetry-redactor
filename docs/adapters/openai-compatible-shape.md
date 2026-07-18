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
- Provider streaming chunks remain metadata-only until OpenAI-compatible event
  ordering, cancellation, and content-shape redaction are proven. The core
  built-in rolling helper alone does not satisfy this adapter gate.

## Implemented Behavior

- `redactOpenAICompatibleRequest` redacts `messages[].content`, `prompt`, and
  `input`. String content is handled by core text redaction; structured input and
  multimodal content parts are handled by JSON-like traversal.
- Structured request `response_format` values and response `usage` values also
  pass through JSON-like traversal because schema descriptions and provider
  extensions can carry content. Present non-object values fail closed as an
  unsupported provider shape.
- `redactOpenAICompatibleResponse` redacts `choices[].text`,
  `choices[].message.content`, `choices[].message.tool_calls`, and nested
  `function.arguments`.
- Tool-call `function.arguments` strings are parsed as JSON when possible,
  redacted through tool-argument traversal, and reconstructed by replacing only
  changed string tokens. Numeric lexemes, including integers beyond JavaScript's
  safe integer range, and unchanged whitespace or escapes are preserved exactly.
  Duplicate object keys fail closed because collapsing them or falling back to
  raw-text inspection could leave an earlier or escaped value uninspected.
  Other malformed argument strings also fail closed with
  `malformed_tool_arguments`; the adapter does not return a partially inspected
  argument payload.
- Lossless JSON parsing enforces `maxStringLength`, `maxObjectDepth`,
  `maxObjectKeys`, `maxArrayLength`, and `maxTotalNodes` before constructing an
  over-limit semantic value. Limit failures remain fail closed and do not fall
  back to exporting a partially inspected string.
- Tool names are treated as metadata by default. Callers must opt in with
  `redactToolNames` when their policy treats tool names as content-bearing.
- Request and response helpers accept either inline core redaction options or a
  reusable `{ profile, signal? }` operation. Adapter-only options such as
  `redactToolNames` are separated before the core operation runs and cannot
  override profile policy.
- `maxTotalDurationMs` is one deadline for the complete adapter request or
  response operation. Each content-bearing field receives only the remaining
  duration; traversing another field does not reset the configured budget.
- `maxTotalDetections` and `maxDetectorRuns` are likewise cumulative across
  content-bearing fields. A text field is not dispatched when its detector count
  would exceed the remaining run budget.
- `maxTotalNodes` and `maxTotalStringLength` also use the safe numeric resource
  usage reported by core, so later fields receive only their remaining budget.
- `redactOpenAICompatibleStreamEvent` omits chunk content and returns only
  metadata with `streaming_content_omitted`.

## Unknown Shape Policy

Unknown or unsupported shapes must not be assumed safe. The adapter should omit
content-bearing telemetry and emit a safe warning such as
`unsupported_provider_shape`.

Shape inspection failures from getters, proxies, or non-plain provider objects
also fail closed without propagating the original exception. Malformed adapter
options return `invalid_redaction_options` without inspecting or returning the
provider payload.

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

Allowlisted fields are also runtime type checked: scalar metadata cannot contain
objects, response `text` must be a string, and known arrays and records must have
the expected shape. Plain records may contain only enumerable string-keyed data
properties. Symbols, accessors, class instances, and non-plain prototypes fail
closed. Explicit `undefined` on an optional metadata field is treated as absent.

## Review Blockers

- A provider SDK becomes a required dependency for the core redaction path.
- Unknown shape handling exports raw content.
- Streaming chunks are exported before buffer and chunk-boundary fixtures exist.
