import { trpc } from "@/lib/trpc";

export function useVisitRoomData(input: {
  accessInput: {
    appointmentId: number;
    token: string;
    lang: "en" | "zh";
  };
  validInput: boolean;
}) {
  const appointmentQuery = trpc.appointments.getByToken.useQuery(input.accessInput, {
    enabled: input.validInput,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const doctorQuery = trpc.doctors.getById.useQuery(
    { id: appointmentQuery.data?.doctorId ?? 0 },
    {
      enabled: Boolean(appointmentQuery.data?.doctorId),
      retry: 1,
    }
  );

  return {
    appointmentQuery,
    doctorQuery,
  };
}
