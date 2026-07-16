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
  and workflow filename that owns release publishing. Allow
  `npm stage publish` and disable direct `npm publish` for that trust
  relationship.
- Require the release tag to match `v${package.json.version}` before install,
  validation, or staging steps run.
- Pin the npm CLI used for staged publishing instead of installing `npm@latest`;
  trusted publishing behavior can differ across npm major/minor releases.
- Treat long-lived npm tokens as bootstrap or emergency recovery tools only;
  they must not be required by the release workflow or committed to repository
  files.
- Verify current npm trusted publishing requirements before writing workflow
  files because npm and CI requirements can change.
- Before staging, install the pinned N-1 baseline and the current packed artifact
  into the shared consumer fixture.
- CI submits a release with npm staged publishing. A maintainer must review and
  approve the staged package with 2FA in npm before it becomes public. Stage
  approval is a human-only proof-of-presence boundary and is not automated with
  an npm token.
- After approval, rerun the tag workflow. It installs the exact public version
  and the pinned N-1 baseline into the shared consumer fixture. Do not treat a
  local tarball check as proof that the registry artifact is consumable.
- After exact registry compatibility passes, create the GitHub Release from the
  same tag and commit. The step is idempotent so a manually created release is
  preserved rather than duplicated.
- Do not rerun the tag workflow while the stage is still pending. After approval,
  wait until the exact version is visible in the npm registry before rerunning;
  an early rerun can correctly fail because the staged version already reserves
  that semver version.
- Poll exact-version registry metadata for at most 60 seconds before the
  post-publish install. A successful publish can precede public registry
  visibility briefly; an exhausted visibility window remains a release failure.
- Keep `pnpm run release-readiness` outside the normal `check` runner while the
  package is intentionally unpublished. It must fail with explicit blockers until
  package metadata and trusted publishing workflow requirements are satisfied.

## Verification Evidence

A trusted-publishing setup is proven when the workflow stages a previously
unstaged package version without npm token configuration. A release is complete
only after a maintainer approves that stage with 2FA and a workflow rerun verifies
the exact public registry version and creates or confirms the matching GitHub
Release.

## Release Blockers

- A release requires long-lived npm tokens without a documented reason.
- The npm trusted publisher does not allow `npm stage publish`, or still allows
  direct `npm publish` after the staged-only policy is adopted.
- Package exports drift from public API docs.
- The release tag and package version do not match.
- Release artifacts include raw GenAI content or live-looking secrets.
- Semver and migration notes omit detector default, replacement-token, or mapper
  changes.
