import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/llm", () => ({
  createEmbedding: vi.fn(),
  invokeLLM: vi.fn(),
}));

vi.mock("./repo", () => ({
  listDoctorSpecialtyTagsByDoctorIds: vi.fn(),
  listRecommendationCandidates: vi.fn(),
  searchDoctors: vi.fn(),
  searchDoctorsByEmbedding: vi.fn(),
}));

import { createEmbedding, invokeLLM } from "../../_core/llm";
import * as doctorsRepo from "./repo";
import { retrieveRecommendationBuckets } from "./recommendationSupport";
import { recommendDoctors } from "./recommendationWorkflow";

describe("doctor recommendation logging", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createEmbedding).mockResolvedValue([0.1] as never);
    vi.mocked(doctorsRepo.searchDoctors).mockResolvedValue([]);
    vi.mocked(doctorsRepo.searchDoctorsByEmbedding).mockResolvedValue([]);
    vi.mocked(doctorsRepo.listRecommendationCandidates).mockResolvedValue([]);
    vi.mocked(doctorsRepo.listDoctorSpecialtyTagsByDoctorIds).mockResolvedValue(
      new Map()
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("protects keyword translation failures and completion telemetry", async () => {
    vi.mocked(invokeLLM).mockRejectedValue(
      new Error("private translated symptom detail")
    );
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});

    await expect(
      recommendDoctors({
        keywords: ["private-unmapped-symptom"],
        summary: "private patient medical summary",
      })
    ).resolves.toEqual([]);

    expect(JSON.parse(String(consoleWarn.mock.calls[0]?.[0]))).toMatchObject({
      component: "doctor-recommendation",
      event: "keyword_translation_failed",
      errorName: "Error",
    });
    const telemetry = String(consoleInfo.mock.calls[0]?.[0]);
    const telemetryPayload = JSON.parse(telemetry);
    expect(telemetryPayload).toMatchObject({
      component: "doctor-recommendation",
      event: "completed",
      keywordCount: 1,
      finalCount: 0,
    });
    expect(telemetryPayload).not.toHaveProperty("matchedIntents");
    expect(telemetryPayload).not.toHaveProperty("tagHints");
    expect(
      `${String(consoleWarn.mock.calls[0]?.[0])}${telemetry}`
    ).not.toContain("private");
  });

  it("protects vector retrieval failures while preserving empty fallback", async () => {
    vi.mocked(createEmbedding).mockRejectedValue(
      new Error("private semantic query detail")
    );
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      retrieveRecommendationBuckets({
        zhQueryKeywords: [],
        enQueryKeywords: [],
        translatedZhKeywords: [],
        semanticQuery: "private vector symptom",
      })
    ).resolves.toEqual({
      zhResults: [],
      enResults: [],
      vectorResults: [],
    });

    const logged = String(consoleWarn.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toMatchObject({
      component: "doctor-recommendation-retrieval",
      event: "vector_retrieval_failed",
      errorName: "Error",
    });
    expect(logged).not.toContain("private");
  });

  it("protects recommendation failures while preserving the empty result", async () => {
    vi.mocked(doctorsRepo.searchDoctors).mockRejectedValue(
      new Error("private patient search detail")
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      recommendDoctors({ keywords: ["专用失败症状"] })
    ).resolves.toEqual([]);

    const logged = String(consoleError.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toMatchObject({
      component: "doctor-recommendation",
      event: "failed",
      errorName: "Error",
    });
    expect(logged).not.toContain("private patient search detail");
    expect(logged).not.toContain("专用失败症状");
  });
});
