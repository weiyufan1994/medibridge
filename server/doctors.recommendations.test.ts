import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestContext,
  mockDepartments,
  mockDoctors,
  mockHospitals,
  resetDoctorsTestState,
} from "./doctors.test-setup";
import * as llm from "./_core/llm";
import * as doctorsRepo from "./modules/doctors/repo";
import { appRouter } from "./routers";

describe("doctors router", () => {
  beforeEach(resetDoctorsTestState);

  it("should search doctors by keywords", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.doctors.search({
      keywords: ["心脏", "外科"],
      limit: 5,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);

    if (result.length > 0) {
      const firstResult = result[0];
      expect(firstResult).toHaveProperty("doctor");
      expect(firstResult).toHaveProperty("hospital");
      expect(firstResult).toHaveProperty("department");
      expect(firstResult.doctor).toHaveProperty("id");
      expect(firstResult.doctor).toHaveProperty("name");
    }
  });

  it("should get doctor by ID", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // First search for a doctor
    const searchResult = await caller.doctors.search({
      keywords: ["医生"],
      limit: 1,
    });

    if (searchResult.length > 0) {
      const doctorId = searchResult[0].doctor.id;

      const result = await caller.doctors.getById({ id: doctorId });

      expect(result).toBeDefined();
      expect(result).toHaveProperty("doctor");
      expect(result).toHaveProperty("hospital");
      expect(result).toHaveProperty("department");
      expect(result!.doctor.id).toBe(doctorId);
      expect(result!.doctor.name).toEqual({
        zh: "张医生",
        en: "Dr. Zhang",
      });
      expect(result!.hospital.name).toEqual({
        zh: "示例医院",
        en: "Example Hospital",
      });
      expect(result!.department.name).toEqual({
        zh: "骨科",
        en: "Orthopedics",
      });
    }
  });

  it("should return null for non-existent doctor ID", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.doctors.getById({ id: 999999 });

    expect(result).toBeNull();
  });

  it("prioritizes musculoskeletal departments for knee-joint triage recommendations", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.doctors.recommend({
      keywords: ["膝关节疼痛", "关节积液", "骨科"],
      summary: "患者膝关节疼痛，曾有膝盖积水，活动后加重。",
      limit: 3,
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.department.name.zh).toBe("骨科");
    expect(result[0]?.doctor.name.zh).toBe("张医生");

    const orthoIndex = result.findIndex(
      item => item.department.name.zh === "骨科"
    );
    const reproductiveIndex = result.findIndex(
      item => item.department.name.zh === "辅助生殖科"
    );
    const oralIndex = result.findIndex(
      item => item.department.name.zh === "口腔黏膜科"
    );

    expect(orthoIndex).toBeGreaterThanOrEqual(0);
    expect(reproductiveIndex === -1 || orthoIndex < reproductiveIndex).toBe(
      true
    );
    expect(oralIndex === -1 || orthoIndex < oralIndex).toBe(true);
  });

  it("restricts vector retrieval to the specialty candidate pool when triage intent is clear", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await caller.doctors.recommend({
      keywords: ["膝关节疼痛", "关节积液"],
      summary: "患者膝关节疼痛，伴随活动受限。",
      limit: 3,
    });

    expect(doctorsRepo.searchDoctorsByEmbedding).toHaveBeenCalledWith(
      [0.1, 0.2, 0.3],
      20,
      { candidateDoctorIds: [1, 4] }
    );
    expect(doctorsRepo.searchDoctors).toHaveBeenCalledWith(
      expect.any(Array),
      20,
      expect.objectContaining({ candidateDoctorIds: [1, 4] })
    );
  });

  it("returns a non-empty orthopedic recommendation for tibia fracture triage", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.doctors.recommend({
      keywords: ["胫骨骨折", "摔伤", "右小腿红肿"],
      summary: "患者昨日摔倒后右侧小腿疼痛，拍片提示胫骨骨折。",
      limit: 3,
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.department.name.zh).toBe("骨科");
  });

  it("returns oral and maxillofacial recommendations for jaw fracture triage", async () => {
    vi.mocked(llm.invokeLLM).mockResolvedValue({
      id: "resp_1",
      created: Date.now(),
      model: "mock",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: JSON.stringify({
              keywordsZh: ["颌面骨折", "口腔颌面外科"],
            }),
          },
        },
      ],
    });

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.doctors.recommend({
      keywords: ["jaw fracture", "maxillofacial swelling", "oral surgery"],
      summary: "Facial fracture with jaw pain and swelling after trauma.",
      limit: 3,
    });

    expect(result.length).toBeGreaterThan(0);
    expect(
      result.some(
        item =>
          item.department.name.en === "Oral and Maxillofacial Surgery" ||
          item.department.name.en === "Oral Medicine"
      )
    ).toBe(true);
  });

  it("falls back to unrestricted search when specialty candidate retrieval is empty", async () => {
    vi.mocked(doctorsRepo.searchDoctors).mockImplementation(
      async (
        _keywords: string[],
        _limit?: number,
        options?: { candidateDoctorIds?: number[] }
      ) =>
        options?.candidateDoctorIds
          ? []
          : [
              {
                doctor: mockDoctors[0],
                hospital: mockHospitals[0],
                department: mockDepartments[0],
              },
            ]
    );
    vi.mocked(doctorsRepo.searchDoctorsByEmbedding).mockImplementation(
      async (
        _embedding: number[],
        _limit?: number,
        options?: { candidateDoctorIds?: number[] }
      ) => (options?.candidateDoctorIds ? [] : [])
    );

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.doctors.recommend({
      keywords: ["胫骨骨折", "摔伤"],
      summary: "患者下肢摔伤后拍片提示胫骨骨折。",
      limit: 3,
    });

    expect(result.length).toBeGreaterThan(0);
    expect(
      vi
        .mocked(doctorsRepo.searchDoctors)
        .mock.calls.some(
          ([, , options]) => options?.candidateDoctorIds === undefined
        )
    ).toBe(true);
  });

  it("returns ranked fallback candidates instead of an empty list when retrieval misses everything", async () => {
    vi.mocked(doctorsRepo.searchDoctors).mockResolvedValue([]);
    vi.mocked(doctorsRepo.searchDoctorsByEmbedding).mockResolvedValue([]);

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.doctors.recommend({
      keywords: ["胫骨骨折", "摔伤"],
      summary: "患者下肢摔伤后拍片提示胫骨骨折。",
      limit: 3,
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.department.name.zh).toBe("骨科");
  });
});
