import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import * as llm from "./_core/llm";

const mockDoctors = [
  {
    id: 1,
    name: "张医生",
    nameEn: "Dr. Zhang",
    title: "主任医师",
    titleEn: "Chief Physician",
    specialty: "骨科",
    specialtyEn: "Orthopedics",
    expertise: "膝关节、关节积液、运动损伤",
    expertiseEn: "Knee joint pain, joint effusion, sports injury",
    description: "",
    experience: "15年",
    recommendationScore: 95,
  },
  {
    id: 2,
    name: "林嘉盈",
    nameEn: "Dr. Lin",
    title: "主任医师",
    titleEn: "Chief Physician",
    specialty: "辅助生殖科",
    specialtyEn: "Reproductive Medicine",
    expertise: "辅助生殖",
    expertiseEn: "Reproductive medicine",
    description: "",
    experience: "12年",
    recommendationScore: 98,
  },
  {
    id: 3,
    name: "周海文",
    nameEn: "Dr. Zhou",
    title: "主任医师",
    titleEn: "Chief Physician",
    specialty: "口腔黏膜科",
    specialtyEn: "Oral Medicine",
    expertise: "口腔黏膜疾病",
    expertiseEn: "Oral mucosal disease",
    description: "",
    experience: "10年",
    recommendationScore: 96,
  },
  {
    id: 4,
    name: "陈颌面",
    nameEn: "Dr. Chen",
    title: "主任医师",
    titleEn: "Chief Physician",
    specialty: "口腔颌面外科",
    specialtyEn: "Oral and Maxillofacial Surgery",
    expertise: "颌面骨折、下颌损伤、口腔颌面创伤",
    expertiseEn: "Jaw fractures, mandibular trauma, oral and maxillofacial surgery",
    description: "",
    experience: "18年",
    recommendationScore: 99,
  },
];

const mockHospitals = [
  {
    id: 10,
    name: "示例医院",
    nameEn: "Example Hospital",
    city: "上海",
    cityEn: "Shanghai",
    level: "三甲",
    levelEn: "Tier 3A",
    address: "上海市徐汇区示例路 1 号",
    addressEn: "1 Sample Rd, Xuhui District, Shanghai",
  },
];

const mockDepartments = [
  {
    id: 100,
    hospitalId: 10,
    name: "骨科",
    nameEn: "Orthopedics",
  },
  {
    id: 101,
    hospitalId: 10,
    name: "辅助生殖科",
    nameEn: "Reproductive Medicine",
  },
  {
    id: 102,
    hospitalId: 10,
    name: "口腔黏膜科",
    nameEn: "Oral Medicine",
  },
  {
    id: 103,
    hospitalId: 10,
    name: "口腔颌面外科",
    nameEn: "Oral and Maxillofacial Surgery",
  },
];

const mockRecommendationCandidates = [
  {
    doctor: mockDoctors[0],
    hospital: mockHospitals[0],
    department: mockDepartments[0],
  },
  {
    doctor: mockDoctors[1],
    hospital: mockHospitals[0],
    department: mockDepartments[1],
  },
  {
    doctor: mockDoctors[2],
    hospital: mockHospitals[0],
    department: mockDepartments[2],
  },
  {
    doctor: mockDoctors[3],
    hospital: mockHospitals[0],
    department: mockDepartments[3],
  },
];

vi.mock("./modules/doctors/repo", () => {
  const filterByCandidateDoctorIds = (
    results: typeof mockRecommendationCandidates,
    candidateDoctorIds?: number[]
  ) => {
    if (!candidateDoctorIds || candidateDoctorIds.length === 0) {
      return results;
    }
    return results.filter(result => candidateDoctorIds.includes(result.doctor.id));
  };

  return {
    searchDoctors: vi.fn(async (
      _keywords: string[],
      _limit?: number,
      options?: { candidateDoctorIds?: number[] }
    ) =>
      filterByCandidateDoctorIds(
        mockRecommendationCandidates,
        options?.candidateDoctorIds
      )
    ),
    getDoctorById: vi.fn(async (id: number) => {
      if (id === 999999) return null;
      return {
        doctor: mockDoctors[0],
        hospital: mockHospitals[0],
        department: mockDepartments[0],
      };
    }),
    getAllHospitals: vi.fn(async () => mockHospitals),
    getDepartmentsByHospital: vi.fn(async (hospitalId: number) =>
      mockDepartments.filter(item => item.hospitalId === hospitalId)
    ),
    getDoctorsByDepartment: vi.fn(async () => []),
    searchDoctorsByEmbedding: vi.fn(async (
      _embedding: number[],
      _limit?: number,
      options?: { candidateDoctorIds?: number[] }
    ) =>
      filterByCandidateDoctorIds(
        [
          {
            doctor: mockDoctors[3],
            hospital: mockHospitals[0],
            department: mockDepartments[3],
          },
          {
            doctor: mockDoctors[0],
            hospital: mockHospitals[0],
            department: mockDepartments[0],
          },
        ],
        options?.candidateDoctorIds
      )
    ),
    listRecommendationCandidates: vi.fn(async () => mockRecommendationCandidates),
    listDoctorSpecialtyTagsByDoctorIds: vi.fn(async () => new Map()),
  };
});

vi.mock("./_core/llm", () => ({
  createEmbedding: vi.fn(async () => [0.1, 0.2, 0.3]),
  invokeLLM: vi.fn(),
}));

import { appRouter } from "./routers";
import * as doctorsRepo from "./modules/doctors/repo";

function createTestContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("doctors router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should search doctors by keywords", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.doctors.search({
      keywords: ["心脏", "外科"],
      limit: 5
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
      limit: 1
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

    const orthoIndex = result.findIndex(item => item.department.name.zh === "骨科");
    const reproductiveIndex = result.findIndex(
      item => item.department.name.zh === "辅助生殖科"
    );
    const oralIndex = result.findIndex(item => item.department.name.zh === "口腔黏膜科");

    expect(orthoIndex).toBeGreaterThanOrEqual(0);
    expect(reproductiveIndex === -1 || orthoIndex < reproductiveIndex).toBe(true);
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
        .mock.calls.some(([, , options]) => options?.candidateDoctorIds === undefined)
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

describe("hospitals router", () => {
  it("should get all hospitals", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.hospitals.getAll();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    
    const firstHospital = result[0];
    expect(firstHospital).toHaveProperty("id");
    expect(firstHospital).toHaveProperty("name");
    expect(firstHospital?.name).toEqual({
      zh: "示例医院",
      en: "Example Hospital",
    });
  });

  it("should get departments by hospital ID", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // First get a hospital
    const hospitals = await caller.hospitals.getAll();
    
    if (hospitals.length > 0) {
      const hospitalId = hospitals[0].id;
      
      const result = await caller.hospitals.getDepartments({ hospitalId });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      if (result.length > 0) {
        const firstDept = result[0];
        expect(firstDept).toHaveProperty("id");
        expect(firstDept).toHaveProperty("name");
        expect(firstDept.hospitalId).toBe(hospitalId);
        expect(firstDept.name).toEqual({
          zh: "骨科",
          en: "Orthopedics",
        });
      }
    }
  });
});
