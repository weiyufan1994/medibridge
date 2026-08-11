import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../ai/publicApi", () => ({
  aiHistoricalTriageApi: { getForUser: vi.fn() },
}));
vi.mock("./repo", () => ({
  getDepartmentById: vi.fn(),
  getHospitalById: vi.fn(),
  listActiveContactsByHospital: vi.fn(),
  listDepartmentsByHospitalId: vi.fn(),
  listHospitalsForReferralCatalog: vi.fn(),
}));

import { aiHistoricalTriageApi } from "../ai/publicApi";
import * as referralRepo from "./repo";
import {
  getSelectionContextAction,
  getTriageRecommendationsAction,
} from "./triageActions";

const session = {
  id: 81,
  userId: 701,
  summary: "Persistent digestive symptoms.",
};
const rankedHospital = {
  hospitalName: "复旦大学附属中山医院",
  city: "上海",
  specialtyRank: 1,
  specialtyScore: 96,
  generalGrade: "A++",
  stemRank: 3,
  matchedHospitalId: 11,
  matchedDepartmentId: 21,
  reason: "Strong gastroenterology match.",
};
const triageResult = {
  routing: {
    recommendedDepartment: { zh: "消化内科", en: "Gastroenterology" },
    hospitals: [rankedHospital],
  },
};
const hospital = {
  id: 11,
  name: "复旦大学附属中山医院",
  nameEn: "Zhongshan Hospital",
  city: "上海",
  cityEn: "Shanghai",
  level: "",
  levelEn: "",
  imageUrl: null,
  isActive: 1,
};
const department = {
  id: 21,
  hospitalId: 11,
  name: "消化内科",
  nameEn: "Gastroenterology",
  isActive: 1,
};
const contact = {
  id: 31,
  hospitalId: 11,
  departmentId: 21,
  name: "Referral coordinator",
  roleType: "coordinator",
  languages: ["zh", "en"],
  specialtyTags: ["digestive"],
  avgResponseTimeMinutes: 20,
  successRate: 90,
  isActive: 1,
};

describe("referral triage actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aiHistoricalTriageApi.getForUser).mockResolvedValue({
      session,
      triageResult,
    } as never);
    vi.mocked(referralRepo.getHospitalById).mockResolvedValue(
      hospital as never
    );
    vi.mocked(referralRepo.getDepartmentById).mockResolvedValue(
      department as never
    );
    vi.mocked(referralRepo.listActiveContactsByHospital).mockResolvedValue([
      contact,
    ] as never);
    vi.mocked(referralRepo.listDepartmentsByHospitalId).mockResolvedValue(
      [] as never
    );
    vi.mocked(referralRepo.listHospitalsForReferralCatalog).mockResolvedValue(
      [] as never
    );
  });

  it("requires authentication before reading a triage recommendation", async () => {
    await expect(
      getTriageRecommendationsAction(null, { triageSessionId: 81 })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Please sign in to continue.",
    });
    expect(aiHistoricalTriageApi.getForUser).not.toHaveBeenCalled();
  });

  it("returns only the owned triage snapshot and routing result", async () => {
    await expect(
      getTriageRecommendationsAction({ id: 701 } as never, {
        triageSessionId: 81,
      })
    ).resolves.toEqual({
      triageSessionId: 81,
      summary: "Persistent digestive symptoms.",
      recommendedDepartment: {
        zh: "消化内科",
        en: "Gastroenterology",
      },
      hospitals: [rankedHospital],
    });
    expect(aiHistoricalTriageApi.getForUser).toHaveBeenCalledWith({
      sessionId: 81,
      userId: 701,
    });
  });

  it("rejects a triage session that is not owned by the user", async () => {
    vi.mocked(aiHistoricalTriageApi.getForUser).mockResolvedValue(null);

    await expect(
      getSelectionContextAction({ id: 702 } as never, {
        triageSessionId: 81,
        rankedHospitalIndex: 0,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Triage session not found",
    });
  });

  it("resolves active local catalog records and contacts by ranked ids", async () => {
    const result = await getSelectionContextAction({ id: 701 } as never, {
      triageSessionId: 81,
      rankedHospitalIndex: 0,
    });

    expect(result).toMatchObject({
      triageSessionId: 81,
      recommendationReason: "Strong gastroenterology match.",
      manualFulfillmentRequired: false,
      manualFallbackAvailable: false,
      hospital: { id: 11, isLocalCatalogMatch: true },
      department: { id: 21, isLocalCatalogMatch: true },
      contacts: [{ id: 31, name: "Referral coordinator" }],
    });
    expect(referralRepo.listActiveContactsByHospital).toHaveBeenCalledWith({
      hospitalId: 11,
      departmentId: 21,
    });
  });

  it("falls back to normalized hospital and department labels", async () => {
    vi.mocked(aiHistoricalTriageApi.getForUser).mockResolvedValue({
      session,
      triageResult: {
        routing: {
          ...triageResult.routing,
          hospitals: [
            {
              ...rankedHospital,
              hospitalName: "Zhongshan Hospital",
              matchedHospitalId: null,
              matchedDepartmentId: null,
            },
          ],
        },
      },
    } as never);
    vi.mocked(referralRepo.listHospitalsForReferralCatalog).mockResolvedValue([
      hospital,
    ] as never);
    vi.mocked(referralRepo.listDepartmentsByHospitalId).mockResolvedValue([
      { ...department, name: "消化内科（门诊）" },
    ] as never);

    const result = await getSelectionContextAction({ id: 701 } as never, {
      triageSessionId: 81,
      rankedHospitalIndex: 0,
    });

    expect(result).toMatchObject({
      manualFulfillmentRequired: false,
      hospital: { id: 11 },
      department: { id: 21 },
    });
    expect(referralRepo.getHospitalById).not.toHaveBeenCalled();
    expect(referralRepo.getDepartmentById).not.toHaveBeenCalled();
  });

  it("returns a manual fallback when no ranked hospital is locally mapped", async () => {
    vi.mocked(referralRepo.getHospitalById).mockResolvedValue(null as never);

    const result = await getSelectionContextAction({ id: 701 } as never, {
      triageSessionId: 81,
      rankedHospitalIndex: 0,
    });

    expect(result).toMatchObject({
      manualFulfillmentRequired: true,
      manualFallbackAvailable: true,
      hospital: { id: null, isLocalCatalogMatch: false },
      department: { id: null, isLocalCatalogMatch: false },
      contacts: [],
    });
  });
});
