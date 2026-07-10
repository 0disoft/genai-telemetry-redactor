# Redaction Profile Composition Policy

Status: Accepted

## Context

Callers often need to reuse the same detector selection, custom detectors,
limits, and replacement policy across prompt, completion, tool-argument, and
streaming boundaries. Repeating a `RedactionOptions` object at every call site
makes policy drift easy: one path may accidentally restore built-in detectors,
drop a total-duration limit, or use a different replacement policy.

Detector composition is also a security boundary. A field-level custom detector
may intentionally cover an entire telemetry field while a built-in detector
finds a smaller token inside that field. Those ranges can partially overlap from
different starts. Automatically preferring the custom detector, the built-in
detector, the longest range, or the first detector would hide ambiguity and can
leave an unreviewed suffix unredacted.

## Decision

Add a future core API named `createRedactionProfile(config)` that creates an
opaque, immutable `RedactionProfile` policy snapshot.

Profile creation returns a dedicated discriminated result equivalent to
`{ ok: true, value: RedactionProfile }` or
`{ ok: false, error: SafeRedactionError }`. Invalid static configuration does
not throw. It returns the new safe error code `invalid_redaction_profile`
without a redaction report because no content operation has started.

The profile configuration owns:

- explicit built-in detector selection, including `false` for custom-only
  profiles;
- caller-provided custom detectors;
- redaction limits;
- replacement-token policy.

The profile does not own caller cancellation. Each redaction operation keeps its
own optional `AbortSignal` so reusing one profile cannot leak cancellation state
between concurrent operations.

Existing redaction functions will remain backward compatible with
`RedactionOptions`. A later minor release may additionally accept a
profile-discriminated execution shape equivalent to `{ profile, signal }`.
Profile-backed calls must not accept detector, limit, or replacement overrides
in the same operation. Adapter-specific shape options may coexist only when they
cannot replace the profile's core redaction policy.

Profile construction must snapshot configuration arrays and limit values rather
than retaining mutable caller containers. It must validate static composition
errors before processing content, including an empty effective detector set,
duplicate detector IDs, and a `maxDetectors` value smaller than the configured
detector count. Validation errors must use safe codes and must not include raw
content or caller-provided detector labels in telemetry.

The profile snapshots detector references but cannot clone or freeze arbitrary
caller detector implementations that contain functions or private state.
Callers must treat detector objects as stable after profile creation. The
library must document this residual boundary and must not claim deep immutability
of caller-owned detector internals.

Profiles do not change overlap semantics:

- same-start overlaps continue to keep the longest range and emit
  `overlapping_detection`;
- partial overlaps from different starts continue to fail closed with
  `overlapping_detection`;
- detector order, detector priority, first-match-wins, and automatic built-in
  suppression are not supported;
- a caller that owns a wider field-level detector set must explicitly create a
  custom-only profile instead of combining it with overlapping built-ins.

The first implementation remains provider-agnostic and belongs to the core
package. OpenAI-compatible and SDK integration may consume the opaque profile in
a later compatible change, but the profile must not import provider SDKs,
OpenTelemetry writers, credentials, exporters, or storage clients.

## Consequences

- Security impact: repeated calls can share one reviewed policy without silently
  weakening fail-closed overlap behavior.
- Compatibility impact: existing `RedactionOptions` callers remain valid; the
  profile API is additive and requires a minor release when implemented.
- Mutation impact: caller mutation of the original detector array or limits
  object cannot change an already-created profile; mutation inside a referenced
  caller-owned detector remains outside the library's control.
- Concurrency impact: one immutable profile can be reused concurrently while
  cancellation remains operation-local.
- False-negative or false-positive impact: profile construction does not alter
  detector matching or resolve runtime overlap ambiguity.
- Migration impact: callers may adopt profiles incrementally; custom-only users
  must keep built-ins explicitly disabled.

## Rejected Alternatives

- Detector priority: priority can suppress a partially overlapping detection
  without proving the remaining suffix is safe.
- Longest range always wins: different-start overlaps can still leave content
  outside the selected range or conceal a detector disagreement.
- First detector wins: array order is not a security policy and becomes brittle
  when detector defaults change.
- Automatically disable built-ins when custom detectors exist: custom detectors
  are not necessarily complete replacements for every built-in category.
- Return a mutable `RedactionOptions` preset: callers could spread or mutate the
  preset and accidentally bypass the reviewed policy.

## Source of Truth

- Product scope: `docs/product/02-spec.md`
- Detector contract: `docs/library/detector-contract.md`
- Public API inventory: `docs/library/public-api.md`
- Failure policy: `docs/security/redaction-failure-policy.md`
- Current overlap implementation: `packages/core/src/redact-text.ts`
- Consumer evidence: `zdp-platform-observability` custom-only telemetry profile

## Review Blockers

- Profile use changes partial-overlap failures into successful content export.
- A profile-backed operation can override detectors, limits, or replacement
  policy at the call site.
- Profile construction retains mutable caller arrays or limit objects.
- Documentation claims that arbitrary caller detector objects are deeply
  immutable after profile creation.
- A reusable profile stores an operation-specific `AbortSignal`.
- Validation errors expose detector IDs, reason labels, raw values, or matched
  content through telemetry.
- Provider, exporter, span-writer, credential, or storage dependencies enter the
  core profile boundary.
