import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/llm", () => ({
  createEmbedding: vi.fn(),
  invokeLLM: vi.fn(),
}));

vi.mock("../doctors/publicApi", () => ({
  doctorSearchApi: {
    search: vi.fn(),
    searchByEmbedding: vi.fn(),
  },
}));

import { createEmbedding, invokeLLM } from "../../_core/llm";
import { doctorSearchApi as doctors } from "../doctors/publicApi";
import { buildGroundedRecommendationMessage } from "./doctorRecommendationPresentation";
import { buildDoctorRecommendation } from "./doctorRecommendationWorkflow";

describe("chat doctor recommendation logging", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(doctors.search).mockResolvedValue([] as never);
    vi.mocked(doctors.searchByEmbedding).mockResolvedValue([] as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("protects vector search failures and preserves keyword fallback", async () => {
    vi.mocked(createEmbedding).mockRejectedValue(
      new Error("private symptom and embedding detail")
    );
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await buildDoctorRecommendation({
      extraction: {
        keywords: ["专用测试症状"],
        symptoms: "专用患者病情",
        duration: "3天",
        age: 41,
        urgency: "medium",
        readyForRecommendation: true,
      },
      isEnglish: false,
      assistantMessage: "initial response",
    });

    expect(doctors.search).toHaveBeenCalledWith(["专用测试症状"], 10, {
      lang: "zh",
    });
    expect(result.recommendedDoctors).toEqual([]);
    const logged = String(consoleWarn.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toMatchObject({
      component: "chat-doctor-recommendation",
      event: "vector_search_failed",
      errorName: "Error",
    });
    expect(logged).not.toContain("private symptom and embedding detail");
    expect(logged).not.toContain("专用测试症状");
    expect(logged).not.toContain("专用患者病情");
  });

  it("protects grounded response failures and preserves the template fallback", async () => {
    vi.mocked(invokeLLM).mockRejectedValue(
      new Error("private patient and doctor prompt detail")
    );
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await buildGroundedRecommendationMessage(
      true,
      "private patient symptoms",
      [
        {
          doctorId: 17,
          reason: "Respiratory fit",
          doctorName: "Test Doctor",
          hospitalName: "Test Hospital",
          departmentName: "Respiratory Department",
        },
      ]
    );

    expect(result).toContain("Dr. Test Doctor");
    const logged = String(consoleWarn.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toMatchObject({
      component: "chat-doctor-recommendation-presentation",
      event: "grounded_response_failed",
      language: "en",
      recommendationCount: 1,
      errorName: "Error",
    });
    expect(logged).not.toContain("private");
    expect(logged).not.toContain("Test Doctor");
  });
});
