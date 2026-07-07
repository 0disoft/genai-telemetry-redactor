# npm Publishing

Status: Accepted

## Contract

The project should publish as a package, not deploy as a service. The first npm
package name is `genai-telemetry-redactor`.

## Policy

- Start with one consumer-facing package.
- Keep internal package boundaries private until independent publishing is
  justified.
- Use pnpm workspace layout for implementation.
- Prefer npm trusted publishing with provenance from CI.
- Verify current npm trusted publishing requirements before writing workflow
  files because npm and CI requirements can change.
- Keep `pnpm run release-readiness` outside the normal `check` runner while the
  package is intentionally unpublished. It must fail with explicit blockers until
  package metadata and trusted publishing workflow requirements are satisfied.

## Release Blockers

- A release requires long-lived npm tokens without a documented reason.
- Package exports drift from public API docs.
- Release artifacts include raw GenAI content or live-looking secrets.
- Semver and migration notes omit detector default, replacement-token, or mapper
  changes.
