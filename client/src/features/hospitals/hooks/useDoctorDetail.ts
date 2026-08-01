import type { ResolvedLanguage } from "@/contexts/LanguageContext";
import { buildDoctorDetailInput } from "@/features/hospitals/presentation";
import { trpc } from "@/lib/trpc";

export function useDoctorDetail(doctorId: number, lang: ResolvedLanguage) {
  const { data, isLoading, error } = trpc.doctors.getById.useQuery(
    buildDoctorDetailInput(doctorId, lang),
    { enabled: doctorId > 0 }
  );

  return { data, isLoading, error };
}
