import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function useVisitRoomData(input: {
  accessInput: {
    appointmentId: number;
    token: string;
    lang: "en" | "zh";
  };
  validInput: boolean;
  consultationEndedSuccessText: string;
  consultationEndFailedText: string;
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

  const utils = trpc.useUtils();
  const completeAppointmentMutation = trpc.appointments.completeAppointment.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.appointments.getByToken.invalidate(input.accessInput),
        utils.appointments.listMyAppointments.invalidate(),
        utils.appointments.listMine.invalidate(),
        utils.visit.roomGetMessages.invalidate({
          token: input.accessInput.token,
          limit: 50,
        }),
      ]);
      toast.success(input.consultationEndedSuccessText);
    },
    onError: error => {
      toast.error(error.message || input.consultationEndFailedText);
    },
  });

  return {
    appointmentQuery,
    doctorQuery,
    completeAppointmentMutation,
  };
}
