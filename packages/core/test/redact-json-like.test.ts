import { describe, expect, it } from "vitest";
import type { Detector } from "../src/index.js";
import { redactJsonLike, redactToolArguments } from "../src/index.js";

describe("redactJsonLike", () => {
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
