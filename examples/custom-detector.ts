import {
  defaultReplacementToken,
  redactText,
  type Detection,
  type Detector,
} from "genai-telemetry-redactor";

const customerIdDetector: Detector = {
  id: "example:customer-id",
  reasons: ["custom:customer_id"],
  detect(input): Detection[] {
    const detections: Detection[] = [];
    const pattern = /\bcust_[0-9]{4}\b/g;

    for (let match = pattern.exec(input); match; match = pattern.exec(input)) {
      detections.push({
        reason: "custom:customer_id",
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    return detections;
  },
};

const result = await redactText(
  "Customer cust_1234 can be reached at user@example.invalid.",
  {
    detectors: [customerIdDetector],
    replacement(reason) {
      if (reason === "custom:customer_id") {
        return "[REDACTED:customer_id]";
      }

      return defaultReplacementToken(reason);
    },
  },
);

if (!result.ok) {
  throw new Error(`custom detector example failed: ${result.error.code}`);
}

if (result.value.includes("cust_1234")) {
  throw new Error("custom detector example leaked the customer id");
}

if (result.value.includes("user@example.invalid")) {
  throw new Error("custom detector example leaked the email address");
}

if (result.report.countsByReason["custom:customer_id"] !== 1) {
  throw new Error("custom detector example did not report the custom reason");
}

if (result.report.countsByReason.email !== 1) {
  throw new Error("custom detector example did not keep built-in detectors");
}

export const redactedText = result.value;
export const report = result.report;
