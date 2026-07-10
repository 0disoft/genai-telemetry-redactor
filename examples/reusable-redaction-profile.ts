import {
  createRedactionProfile,
  createRegexDetector,
  redactText,
} from "genai-telemetry-redactor";

const customerIdDetector = createRegexDetector({
  id: "example:profile-customer-id",
  reason: "custom:customer_id",
  pattern: /\bcust_[0-9]{4}\b/,
});

const profileResult = createRedactionProfile({
  builtInDetectors: false,
  detectors: [customerIdDetector],
  limits: {
    maxDetectors: 1,
    maxTotalDurationMs: 1_000,
  },
});

if (!profileResult.ok) {
  throw new Error(`profile creation failed: ${profileResult.error.code}`);
}

const first = await redactText("Customer cust_1234", {
  profile: profileResult.value,
});
const second = await redactText("Customer cust_5678", {
  profile: profileResult.value,
});

if (!first.ok || !second.ok) {
  throw new Error("profile-backed redaction failed");
}

if (first.value.includes("cust_1234") || second.value.includes("cust_5678")) {
  throw new Error("profile-backed redaction leaked a customer id");
}

export const firstRedactedText = first.value;
export const secondRedactedText = second.value;
