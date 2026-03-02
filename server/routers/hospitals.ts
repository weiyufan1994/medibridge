import * as doctorsRepo from "../modules/doctors/repo";
import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const hospitalsRouter = router({
  /**
   * Get all hospitals
   */
  getAll: publicProcedure.query(async () => {
    return await doctorsRepo.getAllHospitals();
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
      return await doctorsRepo.getDepartmentsByHospital(input.hospitalId);
    }),
});
