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

Prefer npm trusted publishing with provenance from CI so the release flow does
not require long-lived npm tokens. Workflow files must still verify current npm
trusted publishing requirements before implementation.

## Review Blockers

- A package release lacks fixture safety checks.
- Long-lived publish tokens are added without a documented reason.
- Public README overclaims DLP, PII, or compliance protection.
