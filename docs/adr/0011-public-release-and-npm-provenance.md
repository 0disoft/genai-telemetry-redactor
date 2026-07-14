# Public Release and npm Provenance

Status: Accepted

## Context

The project currently has documentation but no implementation. A public security
or privacy library should avoid looking like an empty promise.

## Decision

Keep the GitHub repository public, but keep documentation clear that the project
is still pre-implementation scaffolding until package code, tests, and release
artifacts exist.

Use `genai-telemetry-redactor` as the first npm package name, published as one
consumer-facing package. Internal workspace packages may exist, but they should
remain private until independent publishing is justified.

Use npm trusted publishing with provenance from CI so the release flow does not
require long-lived npm tokens. CI may stage a package, but it must not publish a
release directly. A maintainer reviews and approves the immutable staged package
with 2FA before it becomes public, then reruns the tag workflow to verify the
exact registry artifact. The npm trust relationship allows staged publishing and
disables direct publishing.

## Review Blockers

- A package release lacks fixture safety checks.
- Long-lived publish tokens are added without a documented reason.
- CI can move `latest` without a maintainer's npm 2FA approval.
- Public README overclaims DLP, PII, or compliance protection.
