import { toPublicLocalizedDoctorSearchResult } from "./presentation";
import { recommendDoctors as runDoctorRecommendation } from "./recommendationWorkflow";
import * as doctorsRepo from "./repo";
import type {
  GetDoctorByIdInput,
  GetDoctorsByDepartmentInput,
  RecommendDoctorsInput,
  SearchDoctorsInput,
} from "./schemas";

export async function getDoctorById(input: GetDoctorByIdInput) {
  const result = await doctorsRepo.getDoctorById(input.id, input.lang);
  if (!result) {
    return null;
  }

  return toPublicLocalizedDoctorSearchResult(result);
}

export async function searchDoctors(input: SearchDoctorsInput) {
  const results = await doctorsRepo.searchDoctors(input.keywords, input.limit, {
    lang: input.lang ?? "zh",
    fallbackKeywords: input.fallbackKeywords,
  });
  return results.map(toPublicLocalizedDoctorSearchResult);
}

export async function recommendDoctors(input: RecommendDoctorsInput) {
  return runDoctorRecommendation(input);
}

export async function getDoctorsByDepartment(
  input: GetDoctorsByDepartmentInput
) {
  const results = await doctorsRepo.getDoctorsByDepartment(
    input.departmentId,
    input.limit,
    input.lang
  );

  return results.map(toPublicLocalizedDoctorSearchResult);
}
