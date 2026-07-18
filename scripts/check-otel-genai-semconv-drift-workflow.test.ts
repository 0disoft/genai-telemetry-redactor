import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../.github/workflows/otel-semconv-drift.yml", import.meta.url),
  "utf8",
);

describe("OpenTelemetry GenAI semconv drift workflow", () => {
  it("runs only on a bounded schedule or explicit dispatch", () => {
    expect(workflow).toContain("schedule:");
    expect(workflow).toContain('cron: "17 2 * * 1"');
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("pull_request:");
    expect(workflow).not.toContain("push:");
  });

  it("uses the minimum permissions needed to manage the review issue", () => {
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("issues: write");
    expect(workflow).not.toContain("contents: write");
  });

  it("pins every third-party action to a full commit SHA", () => {
    const actionReferences = [
      ...workflow.matchAll(/^\s*uses:\s*([^\s]+)$/gmu),
    ].map(([, reference]) => reference);

    expect(actionReferences).toHaveLength(3);
    for (const reference of actionReferences) {
      expect(reference).toMatch(/^[^@]+@[0-9a-f]{40}$/u);
    }
  });

  it("summarizes and reconciles one reusable drift review issue", () => {
    expect(workflow).toContain("<!-- otel-genai-semconv-drift -->");
    expect(workflow).toContain("core.summary");
    expect(workflow).toContain("github.rest.issues.listForRepo");
    expect(workflow).toContain('state: "all"');
    expect(workflow).toContain("github.rest.issues.update");
    expect(workflow).toContain("github.rest.issues.create");
    expect(workflow).toContain('state: "closed"');
    expect(workflow).toContain('state_reason: "completed"');
    expect(workflow).toContain('state: "open"');
  });

  it("never mutates the pinned source automatically", () => {
    expect(workflow).not.toContain("git push");
    expect(workflow).not.toContain("createPullRequest");
  });
});
