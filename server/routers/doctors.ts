import { publicProcedure, router } from "../_core/trpc";
import { doctorActions, doctorSchemas } from "../modules/doctors/routerApi";

export const doctorsRouter = router({
  /**
   * Get doctor details by ID
   */
  getById: publicProcedure
    .input(doctorSchemas.getDoctorByIdInputSchema)
    .query(({ input }) => doctorActions.getDoctorById(input)),

  /**
   * Search doctors by keywords
   */
  search: publicProcedure
    .input(doctorSchemas.searchDoctorsInputSchema)
    .query(({ input }) => doctorActions.searchDoctors(input)),

  /**
   * Recommend top matched doctors by triage keywords.
   * Uses fuzzy keyword search across doctor/department/hospital fields.
   */
  recommend: publicProcedure
    .input(doctorSchemas.recommendDoctorsInputSchema)
    .query(({ input }) => doctorActions.recommendDoctors(input)),

  /**
   * Get doctors by department
   */
  getByDepartment: publicProcedure
    .input(doctorSchemas.getDoctorsByDepartmentInputSchema)
    .query(({ input }) => doctorActions.getDoctorsByDepartment(input)),
});
