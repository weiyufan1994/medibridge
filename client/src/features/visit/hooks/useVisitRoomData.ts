import { keepPreviousData } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";

export function buildVisitRoomAccessQueryOptions(validInput: boolean) {
  return {
    enabled: validInput,
    retry: false as const,
    refetchOnWindowFocus: false as const,
    refetchOnReconnect: false as const,
    // Poll appointment state so room-closure transitions (ended/completed) are reflected quickly.
    refetchInterval: validInput ? (2000 as const) : (false as const),
    // Keep prior data when switching language so the room UI does not hard-reset to loading.
    placeholderData: keepPreviousData,
  };
}

export function useVisitRoomData(input: {
  accessInput: {
    appointmentId: number;
    token: string;
    lang: "en" | "zh";
  };
  validInput: boolean;
}) {
  const appointmentQuery = trpc.appointments.getByToken.useQuery(
    input.accessInput,
    buildVisitRoomAccessQueryOptions(input.validInput)
  );

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
