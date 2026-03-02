import { trpc } from "@/lib/trpc";

export function useDoctorDetail(doctorId: number) {
  const { data, isLoading, error } = trpc.doctors.getById.useQuery(
    { id: doctorId },
    { enabled: doctorId > 0 }
  );

  return { data, isLoading, error };
}
