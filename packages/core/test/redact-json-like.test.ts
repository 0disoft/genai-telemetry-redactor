import { describe, expect, it } from "vitest";
import type { Detector } from "../src/index.js";
import { redactJsonLike, redactToolArguments } from "../src/index.js";

describe("redactJsonLike", () => {
  it("fails closed when JSON-like shape inspection throws", async () => {
    const input = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("synthetic JSON-like trap");
        },
      },
    );

    const result = await redactJsonLike(input);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unsupported_json_like");
    expect(JSON.stringify(result)).not.toContain("synthetic JSON-like trap");
  });

  it("redacts nested string leaves while preserving object shape", async () => {
    const input = {
      user: {
        email: "user@example.invalid",
        active: true,
        score: 42,
        tags: ["safe", "key_example_value"],
      },
      empty: null,
    };

    const result = await redactJsonLike(input);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toEqual({
      user: {
        email: "[REDACTED:email]",
        active: true,
        score: 42,
        tags: ["safe", "[REDACTED:api_key]"],
      },
      empty: null,
    });
    expect(JSON.stringify(result.value)).not.toContain("user@example.invalid");
    expect(JSON.stringify(result.value)).not.toContain("key_example_value");
    expect(result.report.totalRedactions).toBe(2);
  });

  it("redacts tool argument objects", async () => {
    const result = await redactToolArguments({
      endpoint: "https://example.invalid/customer",
      token: "token_example_value",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toEqual({
      endpoint: "[REDACTED:url]",
      token: "[REDACTED:api_key]",
    });
  });

  it("fails closed when an object key looks content-bearing", async () => {
    const result = await redactToolArguments({
      "user@example.invalid": true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unsafe_object_key");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
    expect(result.report.warnings).toContainEqual(
      expect.objectContaining({
        code: "unsafe_object_key",
        path: "$.{0}",
      }),
    );
  });

  it("fails closed for non-plain objects instead of changing them to empty objects", async () => {
    const result = await redactJsonLike({
      when: new Date("2026-07-08T00:00:00.000Z"),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unsupported_json_like");
  });

  it("fails closed on circular references", async () => {
    const input: Record<string, unknown> = {
      email: "user@example.invalid",
    };
    input.self = input;

    const result = await redactJsonLike(input);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("circular_reference");
    expect(result.error.message).not.toContain("user@example.invalid");
    expect(result.report.status).toBe("failed");
    expect(result.report.totalRedactions).toBe(1);
  });

  it("reuses shared object references without double-counting redactions", async () => {
    const shared = {
      email: "user@example.invalid",
    };
    const result = await redactJsonLike(
      {
        first: shared,
        second: shared,
      },
      {
        limits: {
          maxDetectorRuns: 16,
        },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.first).toBe(result.value.second);
    expect(result.value).toEqual({
      first: {
        email: "[REDACTED:email]",
      },
      second: {
        email: "[REDACTED:email]",
      },
    });
    expect(result.report.totalRedactions).toBe(1);
    expect(result.report.timings).toEqual(
      expect.objectContaining({
        durationMs: expect.any(Number),
        detectorRuns: 16,
        nodesVisited: 4,
        stringCodeUnits: 20,
      }),
    );
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });

  it("fails closed when object depth exceeds limits", async () => {
    const result = await redactJsonLike(
      {
        nested: {
          email: "user@example.invalid",
        },
      },
      {
        limits: {
          maxObjectDepth: 1,
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_object_depth_exceeded");
  });

  it("fails closed when object key count exceeds limits", async () => {
    const result = await redactJsonLike(
      {
        first: "safe",
        second: "user@example.invalid",
      },
      {
        limits: {
          maxObjectKeys: 1,
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_object_keys_exceeded");
  });

  it("fails closed when array length exceeds limits", async () => {
    const result = await redactJsonLike(["safe", "user@example.invalid"], {
      limits: {
        maxArrayLength: 1,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_array_length_exceeded");
  });

  it("fails closed when aggregate node count exceeds limits", async () => {
    const result = await redactJsonLike(
      {
        first: "safe",
        second: "user@example.invalid",
      },
      {
        limits: {
          maxTotalNodes: 2,
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_total_nodes_exceeded");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });

  it("fails closed when aggregate string length exceeds limits", async () => {
    const result = await redactJsonLike(
      {
        first: "safe",
        second: "user@example.invalid",
      },
      {
        limits: {
          maxTotalStringLength: 10,
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_total_string_length_exceeded");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });

  it("fails closed when aggregate detector runs exceed limits", async () => {
    const result = await redactJsonLike(
      {
        first: "safe",
        second: "user@example.invalid",
      },
      {
        builtInDetectors: ["email"],
        limits: {
          maxDetectorRuns: 1,
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_detector_runs_exceeded");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });

  it("fails closed when total traversal duration is already exhausted", async () => {
    const result = await redactJsonLike(
      {
        email: "user@example.invalid",
      },
      {
        limits: {
          maxTotalDurationMs: 0,
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_total_duration_exceeded");
    expect(result.report.status).toBe("failed");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });

  it("counts object key detector runs against aggregate limits", async () => {
    const result = await redactJsonLike(
      {
        first: "safe",
      },
      {
        builtInDetectors: ["email"],
        limits: {
          maxDetectorRuns: 1,
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_detector_runs_exceeded");
    expect(result.report.warnings).toContainEqual(
      expect.objectContaining({
        code: "max_detector_runs_exceeded",
        path: "$.{0}",
      }),
    );
  });

  it("fails closed when detector count exceeds limits during traversal", async () => {
    const result = await redactJsonLike(
      {
        first: "safe",
      },
      {
        limits: {
          maxDetectors: 3,
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_detectors_exceeded");
    expect(result.report.warnings).toContainEqual(
      expect.objectContaining({
        code: "max_detectors_exceeded",
        path: "$.{0}",
      }),
    );
  });

  it("fails closed when aggregate detections exceed limits", async () => {
    const result = await redactJsonLike(
      {
        first: "user@example.invalid",
        second: "admin@example.invalid",
      },
      {
        builtInDetectors: ["email"],
        limits: {
          maxTotalDetections: 1,
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_total_detections_exceeded");
    expect(result.report.totalRedactions).toBe(2);
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
    expect(JSON.stringify(result)).not.toContain("admin@example.invalid");
  });

  it("fails closed when a nested detector throws", async () => {
    const detector: Detector = {
      id: "custom:throwing",
      reasons: ["custom:throws"],
      detect() {
        throw new Error("synthetic detector failure");
      },
    };

    const result = await redactJsonLike(
      {
        email: "user@example.invalid",
      },
      {
        detectors: [detector],
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("detector_failed");
    expect(result.error.message).not.toContain("user@example.invalid");
  });
});
