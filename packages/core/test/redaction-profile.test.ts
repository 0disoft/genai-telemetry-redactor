import { describe, expect, it } from "vitest";
import {
  createBufferedTextStreamRedactor,
  createRedactionProfile,
  createRegexDetector,
  redactJsonLike,
  redactText,
  redactToolArguments,
  type Detector,
  type RedactionLimits,
  type RedactionProfileExecutionOptions,
} from "../src/index.js";

describe("createRedactionProfile", () => {
  it("reuses an immutable custom-only policy across text operations", async () => {
    const detectors: Detector[] = [customerIdDetector("profile:customer-id")];
    const limits: RedactionLimits = { maxDetectors: 1 };
    const creation = createRedactionProfile({
      builtInDetectors: false,
      detectors,
      limits,
    });

    expect(creation.ok).toBe(true);
    if (!creation.ok) {
      return;
    }

    detectors.push(customerIdDetector("profile:later-detector"));
    limits.maxDetectors = 0;

    expect(Object.isFrozen(creation.value)).toBe(true);
    const result = await redactText("Customer cust_1234", {
      profile: creation.value,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toBe("Customer [REDACTED:custom:customer_id]");
    expect(result.report.totalRedactions).toBe(1);
  });

  it("rejects unsafe static profile composition without exposing detector ids", () => {
    const invalidProfiles = [
      createRedactionProfile({ builtInDetectors: false }),
      createRedactionProfile({ limits: { maxDetectors: 3 } }),
      createRedactionProfile({
        builtInDetectors: false,
        detectors: [
          customerIdDetector("profile:duplicate"),
          customerIdDetector("profile:duplicate"),
        ],
      }),
      createRedactionProfile({
        builtInDetectors: ["unknown"],
      } as never),
      createRedactionProfile({
        builtInDetectors: false,
        detectors: [customerIdDetector("profile:signal")],
        signal: new AbortController().signal,
      } as never),
      createRedactionProfile(new Date("2026-07-10T00:00:00.000Z") as never),
      createRedactionProfile({ limits: new Date() as never }),
      createRedactionProfile({
        builtInDetectors: false,
        detectors: [
          {
            id: "profile:no-reasons",
            reasons: [],
            detect: () => [],
          },
        ],
      }),
      createRedactionProfile(
        new Proxy(
          {},
          {
            ownKeys() {
              throw new Error("synthetic profile trap");
            },
          },
        ) as never,
      ),
    ];

    for (const result of invalidProfiles) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("invalid_redaction_profile");
        expect(JSON.stringify(result)).not.toContain("profile:duplicate");
      }
    }
  });

  it("rejects per-call detector overrides for profile-backed operations", async () => {
    const profile = requireProfile();
    const result = await redactText("Customer cust_1234", {
      profile,
      detectors: [],
    } as unknown as RedactionProfileExecutionOptions);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("invalid_redaction_options");
    expect(JSON.stringify(result)).not.toContain("cust_1234");
  });

  it("fails closed when profile execution options throw during inspection", async () => {
    const options = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("synthetic execution trap");
        },
      },
    );

    const result = await redactText(
      "Customer cust_1234",
      options as RedactionProfileExecutionOptions,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_redaction_options");
      expect(JSON.stringify(result)).not.toContain("cust_1234");
    }
  });

  it("keeps cancellation operation-local", async () => {
    const profile = requireProfile();
    const controller = new AbortController();
    controller.abort();

    const aborted = await redactText("Customer cust_1234", {
      profile,
      signal: controller.signal,
    });
    const next = await redactText("Customer cust_1234", { profile });

    expect(aborted.ok).toBe(false);
    if (!aborted.ok) {
      expect(aborted.error.code).toBe("redaction_aborted");
    }
    expect(next.ok).toBe(true);
  });

  it("applies one profile to JSON-like and tool-argument redaction", async () => {
    const profile = requireProfile();
    const jsonResult = await redactJsonLike(
      { customer: "cust_1234" },
      { profile },
    );
    const toolResult = await redactToolArguments(
      { customer: "cust_5678" },
      { profile },
    );

    expect(jsonResult.ok).toBe(true);
    expect(toolResult.ok).toBe(true);
    if (jsonResult.ok && toolResult.ok) {
      expect(JSON.stringify(jsonResult.value)).not.toContain("cust_1234");
      expect(JSON.stringify(toolResult.value)).not.toContain("cust_5678");
    }
  });

  it("applies one profile to final-flush buffered redaction", async () => {
    const profile = requireProfile();
    const stream = createBufferedTextStreamRedactor({ profile });

    const first = stream.push("Customer cust_");
    const second = stream.push("1234");
    const result = await stream.close();

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toContain("cust_1234");
    }
  });
});

function requireProfile() {
  const result = createRedactionProfile({
    builtInDetectors: false,
    detectors: [customerIdDetector("profile:customer-id")],
    limits: {
      maxDetectors: 1,
      maxDetectorRuns: 64,
      maxStreamBufferLength: 1_024,
    },
  });
  if (!result.ok) {
    throw new Error(result.error.code);
  }
  return result.value;
}

function customerIdDetector(id: string) {
  return createRegexDetector({
    id,
    reason: "custom:customer_id",
    pattern: /\bcust_[0-9]{4}\b/,
  });
}
