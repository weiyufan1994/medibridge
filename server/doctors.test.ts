import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mockDoctors = [
  {
    id: 1,
    name: "张医生",
  },
  {
    id: 2,
    name: "李医生",
  },
];

const mockHospitals = [
  {
    id: 10,
    name: "示例医院",
  },
];

const mockDepartments = [
  {
    id: 100,
    hospitalId: 10,
    name: "心内科",
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
    searchDoctorsByEmbedding: vi.fn(async () => []),
  };
});

import { appRouter } from "./routers";

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
    }
  });

  it("should return null for non-existent doctor ID", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.doctors.getById({ id: 999999 });

    expect(result).toBeNull();
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
      }
    }
  });
});
