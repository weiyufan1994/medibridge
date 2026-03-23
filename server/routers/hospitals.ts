import * as doctorsRepo from "../modules/doctors/repo";
import { publicProcedure, router } from "../_core/trpc";
import {
  toPublicLocalizedDepartment,
  toPublicLocalizedHospital,
} from "../modules/doctors/presentation";
import { z } from "zod";

export const hospitalsRouter = router({
  /**
   * Get all hospitals
   */
  getAll: publicProcedure.query(async () => {
    const hospitals = await doctorsRepo.getAllHospitals();
    return hospitals.map(toPublicLocalizedHospital);
  }),

  /**
   * Get departments by hospital
   */
  getDepartments: publicProcedure
    .input(
      z.object({
        hospitalId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const departments = await doctorsRepo.getDepartmentsByHospital(input.hospitalId);
      return departments.map(toPublicLocalizedDepartment);
    }),
});
