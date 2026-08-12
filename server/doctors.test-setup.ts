import { vi } from "vitest";
import type { TrpcContext } from "./_core/context";

export const mockDoctors = [
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
    expertiseEn:
      "Jaw fractures, mandibular trauma, oral and maxillofacial surgery",
    description: "",
    experience: "18年",
    recommendationScore: 99,
  },
];

export const mockHospitals = [
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

export const mockDepartments = [
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

export const mockRecommendationCandidates = [
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

const toLocalizedHospital = (hospital: (typeof mockHospitals)[number]) => ({
  ...hospital,
  name: {
    zh: hospital.name,
    en: hospital.nameEn,
  },
  city: {
    zh: hospital.city,
    en: hospital.cityEn,
  },
  level: {
    zh: hospital.level,
    en: hospital.levelEn,
  },
  address: {
    zh: hospital.address,
    en: hospital.addressEn,
  },
});

const toLocalizedDepartment = (
  department: (typeof mockDepartments)[number]
) => ({
  ...department,
  name: {
    zh: department.name,
    en: department.nameEn,
  },
});

vi.mock("./modules/doctors/repo", () => {
  const filterByCandidateDoctorIds = (
    results: typeof mockRecommendationCandidates,
    candidateDoctorIds?: number[]
  ) => {
    if (!candidateDoctorIds || candidateDoctorIds.length === 0) {
      return results;
    }
    return results.filter(result =>
      candidateDoctorIds.includes(result.doctor.id)
    );
  };

  return {
    searchDoctors: vi.fn(
      async (
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
    getDoctorsByDepartment: vi.fn(async () => []),
    searchDoctorsByEmbedding: vi.fn(
      async (
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
    listRecommendationCandidates: vi.fn(
      async () => mockRecommendationCandidates
    ),
    listDoctorSpecialtyTagsByDoctorIds: vi.fn(async () => new Map()),
  };
});

vi.mock("./modules/hospitals/actions", () => ({
  getAllHospitals: vi.fn(async () => mockHospitals.map(toLocalizedHospital)),
  getDepartmentsByHospital: vi.fn(async (input: { hospitalId: number }) =>
    mockDepartments
      .filter(item => item.hospitalId === input.hospitalId)
      .map(toLocalizedDepartment)
  ),
}));

vi.mock("./_core/llm", () => ({
  createEmbedding: vi.fn(async () => [0.1, 0.2, 0.3]),
  invokeLLM: vi.fn(),
}));

export function createTestContext(): TrpcContext {
  return {
    user: null,
    userId: null,
    deviceId: null,
    requestMetadata: {
      clientIp: "127.0.0.1",
      forwardedHost: null,
      forwardedProto: null,
      host: "medibridge.test",
      protocol: "https",
      requestId: "doctors-test",
      userAgent: "vitest",
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

export function resetDoctorsTestState() {
  vi.clearAllMocks();
}
