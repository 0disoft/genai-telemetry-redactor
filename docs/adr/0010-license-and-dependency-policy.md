# License and Dependency Policy

Status: Accepted

## Context

This privacy-sensitive library may inspect raw prompt, completion, and tool
argument content. Dependencies and copied detector logic can create security,
privacy, and license risk.

## Decision

Use Apache-2.0 for the repository license.

Start with a permissive dependency allowlist: Apache-2.0, MIT, BSD-2-Clause,
BSD-3-Clause, and ISC. GPL, AGPL, LGPL, SSPL, BUSL, Elastic License, Commons
Clause, non-commercial licenses, unclear copied detector regexes, and
non-synthetic datasets are not acceptable for the core package.

Dependencies that see raw content need stricter review than ordinary utility
dependencies.

## Review Blockers

- Detector regexes or fixtures are copied from unclear sources.
- A dependency performs network, storage, telemetry, or logging side effects on
  raw content.
- License policy is missing from package metadata before public package release.
