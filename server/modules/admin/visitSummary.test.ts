import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/llm", () => ({ invokeLLM: vi.fn() }));

import { invokeLLM } from "../../_core/llm";
import { generateBilingualVisitSummary } from "./visitSummary";

const appointment = {
  id: 9_001,
  status: "completed",
  paymentStatus: "paid",
} as never;

function message(input: {
  content: string;
  translatedContent?: string | null;
  senderType?: "patient" | "doctor" | "system";
  minute?: number;
}) {
  return {
    content: input.content,
    translatedContent: input.translatedContent ?? null,
    senderType: input.senderType ?? "patient",
    createdAt: new Date(
      `2026-08-13T01:${String(input.minute ?? 0).padStart(2, "0")}:00.000Z`
    ),
  };
}

function llmResponse(content: unknown) {
  return {
    choices: [{ message: { content } }],
  } as never;
}

describe("admin visit summary generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a bounded fallback without calling the LLM when chat is empty", async () => {
    const result = await generateBilingualVisitSummary({
      appointment,
      triageSummary: `  ${"triage ".repeat(40)}  `,
      messages: [],
    });

    expect(result.source).toBe("fallback");
    expect(result.summaryZh).toContain("问诊单 #9001");
    expect(result.summaryZh).toContain("状态：completed / 支付：paid");
    expect(result.summaryEn).toContain("Consultation #9001");
    expect(result.summaryEn).toContain("Status: completed / Payment: paid");
    expect(result.summaryEn).toContain("...");
    expect(result.summaryEn).not.toMatch(/\s{2,}/);
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("uses only the latest eight non-empty messages in fallback highlights", async () => {
    const messages = Array.from({ length: 10 }, (_, index) =>
      message({
        content: `message-${index} ${"detail ".repeat(20)}`,
        translatedContent: index === 9 ? "preferred translated message" : null,
        senderType: index % 2 === 0 ? "patient" : "doctor",
        minute: index,
      })
    );
    messages[8] = message({ content: "   ", minute: 8 });

    const result = await generateBilingualVisitSummary({
      appointment,
      triageSummary: null,
      messages,
    });

    expect(result.source).toBe("fallback");
    expect(result.summaryEn).not.toContain("message-0");
    expect(result.summaryEn).not.toContain("message-1");
    expect(result.summaryEn).not.toContain("message-8");
    expect(result.summaryEn).toContain("message-2");
    expect(result.summaryEn).toContain("preferred translated message");
    expect(result.summaryEn).not.toContain("message-9");
  });

  it("accepts and bounds a valid bilingual LLM summary", async () => {
    vi.mocked(invokeLLM).mockResolvedValue(
      llmResponse(
        JSON.stringify({
          summaryZh: `  ${"中".repeat(6_010)}  `,
          summaryEn: `  ${"e".repeat(6_010)}  `,
        })
      )
    );

    const result = await generateBilingualVisitSummary({
      appointment,
      triageSummary: "Triage complete",
      messages: [message({ content: "Patient reports cough" })],
    });

    expect(result).toEqual({
      summaryZh: "中".repeat(6_000),
      summaryEn: "e".repeat(6_000),
      source: "llm",
    });
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 1400,
        response_format: expect.objectContaining({ type: "json_schema" }),
      })
    );
  });

  it("combines text response parts and limits the prompt to recent content", async () => {
    const serialized = JSON.stringify({
      summaryZh: "中文会诊摘要内容完整。",
      summaryEn: "Complete English consultation summary.",
    });
    const safeSplitIndex = serialized.indexOf(",") + 1;
    vi.mocked(invokeLLM).mockResolvedValue(
      llmResponse([
        null,
        { type: "image", text: "ignored" },
        { type: "text", text: serialized.slice(0, safeSplitIndex) },
        { type: "text", text: serialized.slice(safeSplitIndex) },
      ])
    );
    const messages = Array.from({ length: 62 }, (_, index) =>
      message({
        content: `message-${index} ${"x".repeat(300)}`,
        minute: index % 60,
      })
    );

    const result = await generateBilingualVisitSummary({
      appointment,
      messages,
    });

    expect(result.source).toBe("llm");
    const llmInput = vi.mocked(invokeLLM).mock.calls[0]?.[0];
    const prompt = String(llmInput?.messages[1]?.content);
    expect(prompt).not.toContain("message-0");
    expect(prompt).not.toMatch(/\] message-1 /);
    expect(prompt).toContain("message-2");
    expect(prompt).toContain("message-61");
    expect(prompt).toContain("Triage summary: (none)");
    expect(prompt).not.toContain("x".repeat(261));
  });

  it.each([
    ["malformed JSON", "not-json"],
    ["a scalar", JSON.stringify("summary")],
    ["missing fields", JSON.stringify({ summaryZh: "仅中文" })],
    ["blank fields", JSON.stringify({ summaryZh: " ", summaryEn: "English" })],
  ])("falls back when the LLM returns %s", async (_label, content) => {
    vi.mocked(invokeLLM).mockResolvedValue(llmResponse(content));

    const result = await generateBilingualVisitSummary({
      appointment,
      messages: [message({ content: "Patient reports cough" })],
    });

    expect(result.source).toBe("fallback");
    expect(result.summaryZh).toContain("问诊单 #9001");
    expect(result.summaryEn).toContain("Consultation #9001");
  });

  it("falls back when the LLM response shape is unsupported or invocation fails", async () => {
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce(llmResponse({ type: "text", text: "ignored" }))
      .mockRejectedValueOnce(new Error("upstream unavailable"));
    const input = {
      appointment,
      messages: [message({ content: "Patient reports cough" })],
    };

    await expect(generateBilingualVisitSummary(input)).resolves.toMatchObject({
      source: "fallback",
    });
    await expect(generateBilingualVisitSummary(input)).resolves.toMatchObject({
      source: "fallback",
    });
  });
});
