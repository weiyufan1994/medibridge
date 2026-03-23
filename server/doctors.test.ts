import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

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
];

vi.mock("./modules/doctors/repo", () => {
  return {
    searchDoctors: vi.fn(async () => [
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
    ]),
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
    searchDoctorsByEmbedding: vi.fn(async () => [
      {
        doctor: mockDoctors[1],
        hospital: mockHospitals[0],
        department: mockDepartments[1],
      },
      {
        doctor: mockDoctors[0],
        hospital: mockHospitals[0],
        department: mockDepartments[0],
      },
    ]),
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

    expect(result).toHaveLength(3);
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
      { candidateDoctorIds: [1] }
    );
    expect(doctorsRepo.searchDoctors).toHaveBeenCalledWith(
      expect.any(Array),
      20,
      expect.objectContaining({ candidateDoctorIds: [1] })
    );
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
