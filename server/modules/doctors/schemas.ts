import { z } from "zod";
import { hospitalBrowseLangSchema } from "../../../shared/hospitalBrowse";

export const getDoctorByIdInputSchema = z.object({
  id: z.number(),
});

export const searchDoctorsInputSchema = z.object({
  keywords: z.array(z.string()),
  limit: z.number().optional(),
  lang: z.enum(["en", "zh"]).optional(),
  fallbackKeywords: z.array(z.string()).optional(),
});

export const recommendDoctorsInputSchema = z.object({
  keywords: z.array(z.string()).min(1),
  summary: z.string().optional(),
  triageSessionId: z.string().optional(),
  limit: z.number().min(1).max(5).optional(),
});

export const getDoctorsByDepartmentInputSchema = z.object({
  departmentId: z.number(),
  limit: z.number().optional(),
  lang: hospitalBrowseLangSchema,
});

export type GetDoctorByIdInput = z.infer<typeof getDoctorByIdInputSchema>;
export type SearchDoctorsInput = z.infer<typeof searchDoctorsInputSchema>;
export type RecommendDoctorsInput = z.infer<typeof recommendDoctorsInputSchema>;
export type GetDoctorsByDepartmentInput = z.infer<
  typeof getDoctorsByDepartmentInputSchema
>;
