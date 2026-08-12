import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestContext,
  mockDepartments,
  mockDoctors,
  mockHospitals,
} from "./doctors.test-setup";
import * as doctorsRepo from "./modules/doctors/repo";
import * as doctorSchemas from "./modules/doctors/schemas";
import * as hospitalActions from "./modules/hospitals/actions";
import * as hospitalSchemas from "./modules/hospitals/schemas";
import { appRouter } from "./routers";

describe("hospitals router", () => {
  it("should get all hospitals", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.hospitals.getAll({ lang: "zh" });

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
    const hospitals = await caller.hospitals.getAll({ lang: "zh" });

    if (hospitals.length > 0) {
      const hospitalId = hospitals[0].id;

      const result = await caller.hospitals.getDepartments({
        hospitalId,
        lang: "zh",
      });

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

  it("defaults omitted or invalid browse locale inputs to zh for this slice", () => {
    expect(hospitalSchemas.getHospitalsInputSchema.parse(undefined)).toEqual({
      lang: "zh",
    });
    expect(
      hospitalSchemas.getHospitalsInputSchema.parse({ lang: "fr" })
    ).toEqual({
      lang: "zh",
    });
    expect(
      hospitalSchemas.getHospitalDepartmentsInputSchema.parse({
        hospitalId: 10,
      })
    ).toEqual({
      hospitalId: 10,
      lang: "zh",
    });
    expect(doctorSchemas.getDoctorByIdInputSchema.parse({ id: 1 })).toEqual({
      id: 1,
      lang: "zh",
    });
    expect(
      doctorSchemas.getDoctorByIdInputSchema.parse({ id: 1, lang: "fr" })
    ).toEqual({
      id: 1,
      lang: "zh",
    });
    expect(
      doctorSchemas.getDoctorsByDepartmentInputSchema.parse({
        departmentId: 100,
        limit: 5,
        lang: "fr",
      })
    ).toEqual({
      departmentId: 100,
      limit: 5,
      lang: "zh",
    });
  });

  it("passes explicit browse locale through the hospital router actions", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await caller.hospitals.getAll({ lang: "en" });
    expect(vi.mocked(hospitalActions.getAllHospitals)).toHaveBeenLastCalledWith(
      {
        lang: "en",
      }
    );

    await caller.hospitals.getDepartments({ hospitalId: 10, lang: "en" });
    expect(
      vi.mocked(hospitalActions.getDepartmentsByHospital)
    ).toHaveBeenLastCalledWith({
      hospitalId: 10,
      lang: "en",
    });
  });
});

describe("hospital browsing doctor list locale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the explicit locale into doctors.getById", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    await caller.doctors.getById({
      id: mockDoctors[0].id,
      lang: "en",
    });

    expect(doctorsRepo.getDoctorById).toHaveBeenLastCalledWith(
      mockDoctors[0].id,
      "en"
    );
  });

  it("passes the explicit locale into doctors.getByDepartment", async () => {
    vi.mocked(doctorsRepo.getDoctorsByDepartment).mockResolvedValue([
      {
        doctor: mockDoctors[0],
        hospital: mockHospitals[0],
        department: mockDepartments[0],
      },
    ]);

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.doctors.getByDepartment({
      departmentId: 100,
      limit: 5,
      lang: "en",
    });

    expect(doctorsRepo.getDoctorsByDepartment).toHaveBeenLastCalledWith(
      100,
      5,
      "en"
    );
    expect(result[0]?.doctor.name.en).toBe("Dr. Zhang");
  });
});
