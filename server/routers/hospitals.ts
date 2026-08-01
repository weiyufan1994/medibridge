import { publicProcedure, router } from "../_core/trpc";
import {
  hospitalActions,
  hospitalSchemas,
} from "../modules/hospitals/routerApi";

export const hospitalsRouter = router({
  /**
   * Get all hospitals
   */
  getAll: publicProcedure
    .input(hospitalSchemas.getHospitalsInputSchema)
    .query(({ input }) => hospitalActions.getAllHospitals(input)),

  /**
   * Get departments by hospital
   */
  getDepartments: publicProcedure
    .input(hospitalSchemas.getHospitalDepartmentsInputSchema)
    .query(({ input }) => hospitalActions.getDepartmentsByHospital(input)),
});
