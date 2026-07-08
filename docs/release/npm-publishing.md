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
- Use npm trusted publishing with provenance from CI for normal releases.
- Configure the npm trusted publisher to match the GitHub owner, repository,
  and workflow filename that owns release publishing.
- Require the release tag to match `v${package.json.version}` before install,
  validation, or publish steps run.
- Treat long-lived npm tokens as bootstrap or emergency recovery tools only;
  they must not be required by the release workflow or committed to repository
  files.
- Verify current npm trusted publishing requirements before writing workflow
  files because npm and CI requirements can change.
- Keep `pnpm run release-readiness` outside the normal `check` runner while the
  package is intentionally unpublished. It must fail with explicit blockers until
  package metadata and trusted publishing workflow requirements are satisfied.

## Verification Evidence

A trusted-publishing setup is proven only by publishing a previously unpublished
package version from the release workflow without npm token configuration in the
workflow file. A rerun that skips publishing because the version already exists
is useful health evidence, but it does not prove tokenless publishing.

## Release Blockers

- A release requires long-lived npm tokens without a documented reason.
- Package exports drift from public API docs.
- The release tag and package version do not match.
- Release artifacts include raw GenAI content or live-looking secrets.
- Semver and migration notes omit detector default, replacement-token, or mapper
  changes.
