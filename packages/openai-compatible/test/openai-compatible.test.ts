import { describe, expect, it, vi } from "vitest";
import { createRedactionProfile, type Detector } from "../../core/src/index.js";
import {
  redactOpenAICompatibleRequest,
  redactOpenAICompatibleResponse,
  redactOpenAICompatibleStreamEvent,
} from "../src/index.js";

describe("OpenAI-compatible adapter", () => {
  it("shares one total-duration deadline across request fields", async () => {
    let now = 1_000;
    let detectorRuns = 0;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
    const detector: Detector = {
      id: "test:adapter-deadline",
      reasons: ["custom:deadline"],
      detect() {
        now += detectorRuns === 0 ? 6 : 5;
        detectorRuns += 1;
        return [];
      },
    };

    try {
      const result = await redactOpenAICompatibleRequest(
        {
          messages: [
            { role: "user", content: "first safe field" },
            { role: "user", content: "second safe field" },
          ],
        },
        {
          builtInDetectors: false,
          detectors: [detector],
          limits: { maxTotalDurationMs: 10 },
        },
      );

      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }

      expect(result.error.code).toBe("max_total_duration_exceeded");
      expect(detectorRuns).toBe(2);
    } finally {
      clock.mockRestore();
    }
  });

  it("shares one detection budget across request fields", async () => {
    const result = await redactOpenAICompatibleRequest(
      {
        messages: [
          { role: "user", content: "first@example.invalid" },
          { role: "user", content: "second@example.invalid" },
        ],
      },
      { limits: { maxTotalDetections: 1 } },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_total_detections_exceeded");
    expect(JSON.stringify(result)).not.toContain("first@example.invalid");
    expect(JSON.stringify(result)).not.toContain("second@example.invalid");
  });

  it("checks cumulative detector runs before the next request field", async () => {
    let detectorRuns = 0;
    const detector: Detector = {
      id: "test:adapter-run-budget",
      reasons: ["custom:run_budget"],
      detect() {
        detectorRuns += 1;
        return [];
      },
    };
    const result = await redactOpenAICompatibleRequest(
      {
        messages: [
          { role: "user", content: "first safe field" },
          { role: "user", content: "second safe field" },
        ],
      },
      {
        builtInDetectors: false,
        detectors: [detector],
        limits: { maxDetectorRuns: 1 },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_detector_runs_exceeded");
    expect(detectorRuns).toBe(1);
  });

  it.each([
    ["maxTotalNodes", { maxTotalNodes: 1 }, "max_total_nodes_exceeded"],
    [
      "maxTotalStringLength",
      { maxTotalStringLength: 10 },
      "max_total_string_length_exceeded",
    ],
  ] as const)(
    "shares one %s budget across request fields",
    async (_name, limits, expectedCode) => {
      const result = await redactOpenAICompatibleRequest(
        {
          messages: [
            { role: "user", content: "123456" },
            { role: "user", content: "abcdef" },
          ],
        },
        { builtInDetectors: false, limits },
      );

      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }

      expect(result.error.code).toBe(expectedCode);
    },
  );

  it("accepts a reusable redaction profile", async () => {
    const creation = createRedactionProfile({
      builtInDetectors: ["email"],
    });
    expect(creation.ok).toBe(true);
    if (!creation.ok) {
      return;
    }

    const result = await redactOpenAICompatibleRequest(
      {
        prompt: "Contact user@example.invalid with token_example_value",
      },
      { profile: creation.value },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.prompt).not.toContain("user@example.invalid");
    expect(result.value.prompt).toContain("token_example_value");
    expect(result.report.totalRedactions).toBe(1);
  });

  it("redacts request message content and prompt strings", async () => {
    const result = await redactOpenAICompatibleRequest({
      model: "model_example",
      messages: [
        {
          role: "user",
          content: "Email user@example.invalid and key_example_value",
        },
      ],
      prompt: "Reach https://example.invalid/private",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(JSON.stringify(result.value)).not.toContain("user@example.invalid");
    expect(JSON.stringify(result.value)).not.toContain("key_example_value");
    expect(JSON.stringify(result.value)).not.toContain(
      "https://example.invalid/private",
    );
    expect(result.report.totalRedactions).toBe(3);
  });

  it("redacts response content and JSON string tool arguments", async () => {
    const result = await redactOpenAICompatibleResponse({
      choices: [
        {
          message: {
            role: "assistant",
            content: "Contact user@example.invalid",
            tool_calls: [
              {
                id: "call_example",
                type: "function",
                function: {
                  name: "lookup",
                  arguments: JSON.stringify({
                    endpoint: "https://example.invalid/customer",
                    token: "token_example_value",
                  }),
                },
              },
            ],
          },
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const output = JSON.stringify(result.value);
    expect(output).not.toContain("user@example.invalid");
    expect(output).not.toContain("https://example.invalid/customer");
    expect(output).not.toContain("token_example_value");
    expect(output).toContain("[REDACTED:email]");
    expect(output).toContain("[REDACTED:url]");
    expect(output).toContain("[REDACTED:api_key]");
    expect(result.report.totalRedactions).toBe(3);
  });

  it("redacts nested request input and multimodal content parts", async () => {
    const result = await redactOpenAICompatibleRequest({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Contact user@example.invalid",
            },
            {
              type: "image_url",
              image_url: {
                url: "https://example.invalid/message-image",
              },
            },
          ],
        },
      ],
      input: [
        {
          type: "input_text",
          text: "Reach second@example.invalid",
        },
        {
          type: "input_image",
          image_url: {
            url: "https://example.invalid/private-image",
          },
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const output = JSON.stringify(result.value);
    expect(output).not.toContain("user@example.invalid");
    expect(output).not.toContain("second@example.invalid");
    expect(output).not.toContain("https://example.invalid/message-image");
    expect(output).not.toContain("https://example.invalid/private-image");
    expect(output).toContain("[REDACTED:email]");
    expect(output).toContain("[REDACTED:url]");
    expect(result.report.totalRedactions).toBe(4);
  });

  it("redacts structured response-format metadata", async () => {
    const result = await redactOpenAICompatibleRequest({
      prompt: "safe prompt",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "contact",
          description:
            "Send results to user@example.invalid via https://example.invalid/result",
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const output = JSON.stringify(result.value);
    expect(output).not.toContain("user@example.invalid");
    expect(output).not.toContain("https://example.invalid/result");
    expect(result.report.totalRedactions).toBe(2);
  });

  it("redacts structured response usage extensions", async () => {
    const result = await redactOpenAICompatibleResponse({
      choices: [{ text: "safe completion" }],
      usage: {
        total_tokens: 2,
        provider_note: "Contact user@example.invalid with token_example_value",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const output = JSON.stringify(result.value);
    expect(output).not.toContain("user@example.invalid");
    expect(output).not.toContain("token_example_value");
    expect(result.report.totalRedactions).toBe(2);
  });

  it.each([
    ["response_format", { prompt: "safe", response_format: "json" }],
    ["usage", { choices: [{ text: "safe" }], usage: "two tokens" }],
  ])("fails closed for malformed %s metadata", async (field, input) => {
    const result =
      field === "response_format"
        ? await redactOpenAICompatibleRequest(input)
        : await redactOpenAICompatibleResponse(input);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unsupported_provider_shape");
  });

  it("redacts malformed tool argument strings as text and warns", async () => {
    const result = await redactOpenAICompatibleResponse({
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  arguments: "{ token: token_example_value",
                },
              },
            ],
          },
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(JSON.stringify(result.value)).not.toContain("token_example_value");
    expect(result.report.warnings).toContainEqual(
      expect.objectContaining({ code: "malformed_tool_arguments" }),
    );
  });

  it("omits streaming content and returns metadata-only warning", () => {
    const result = redactOpenAICompatibleStreamEvent({
      choices: [
        {
          delta: {
            content: "user@example.invalid",
          },
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toEqual({
      contentOmitted: true,
      warningCode: "streaming_content_omitted",
    });
    expect(JSON.stringify(result.value)).not.toContain("user@example.invalid");
    expect(result.report.warnings).toContainEqual(
      expect.objectContaining({ code: "streaming_content_omitted" }),
    );
  });

  it("fails closed for non-object request input", async () => {
    const result = await redactOpenAICompatibleRequest("user@example.invalid");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unsupported_provider_shape");
    expect(result.error.message).not.toContain("user@example.invalid");
  });

  it("fails closed when request shape inspection throws", async () => {
    const input = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("synthetic request trap");
        },
      },
    );

    const result = await redactOpenAICompatibleRequest(input);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unsupported_provider_shape");
  });

  it("fails closed when adapter option inspection throws", async () => {
    const options = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("synthetic adapter options trap");
        },
      },
    );

    const result = await redactOpenAICompatibleRequest(
      { prompt: "Contact user@example.invalid" },
      options,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("invalid_redaction_options");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });

  it("fails closed for invalid adapter-only options", async () => {
    const result = await redactOpenAICompatibleRequest(
      { prompt: "Contact user@example.invalid" },
      { redactToolNames: "yes" } as never,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("invalid_redaction_options");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });

  it("fails closed for unsupported request shapes without known content fields", async () => {
    const result = await redactOpenAICompatibleRequest({
      unknown_content: "user@example.invalid",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unsupported_provider_shape");
    expect(result.report.warnings).toContainEqual(
      expect.objectContaining({
        code: "unsupported_provider_shape",
        path: "$.{0}",
      }),
    );
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });

  it("fails closed for unsupported response shapes", async () => {
    const result = await redactOpenAICompatibleResponse({
      output_text: "user@example.invalid",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unsupported_provider_shape");
    expect(result.report.warnings).toContainEqual(
      expect.objectContaining({
        code: "unsupported_provider_shape",
        path: "$.{0}",
      }),
    );
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });

  it("fails closed for malformed message arrays that could carry raw content", async () => {
    const result = await redactOpenAICompatibleRequest({
      messages: ["user@example.invalid"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unsupported_provider_shape");
    expect(result.report.warnings).toContainEqual(
      expect.objectContaining({
        code: "unsupported_provider_shape",
        path: "$.messages[0]",
      }),
    );
  });

  it("fails closed when response choices carry streaming delta content", async () => {
    const result = await redactOpenAICompatibleResponse({
      choices: [
        {
          delta: {
            content: "user@example.invalid",
          },
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unsupported_provider_shape");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
    expect(result.report.warnings).toContainEqual(
      expect.objectContaining({
        code: "unsupported_provider_shape",
        path: "$.choices[0].{0}",
      }),
    );
  });

  it("preserves prior redaction counts when a later provider shape fails", async () => {
    const result = await redactOpenAICompatibleRequest({
      messages: [
        {
          role: "user",
          content: "Contact user@example.invalid",
        },
        {
          role: "user",
          content: [
            {
              token_example_value: true,
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unsafe_object_key");
    expect(result.report.totalRedactions).toBe(1);
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
    expect(JSON.stringify(result)).not.toContain("token_example_value");
  });
});
