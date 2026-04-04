import { z } from "zod";
import {
  DEFAULT_HOSPITAL_BROWSE_LANG,
  hospitalBrowseLangSchema,
} from "../../../shared/hospitalBrowse";

export const getHospitalsInputSchema = z
  .object({
    lang: hospitalBrowseLangSchema,
  })
  .optional()
  .transform(input => ({
    lang: input?.lang ?? DEFAULT_HOSPITAL_BROWSE_LANG,
  }));

export const getHospitalDepartmentsInputSchema = z.object({
  hospitalId: z.number(),
  lang: hospitalBrowseLangSchema,
});

export type GetHospitalsInput = z.infer<typeof getHospitalsInputSchema>;
export type GetHospitalDepartmentsInput = z.infer<
  typeof getHospitalDepartmentsInputSchema
>;
