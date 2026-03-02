import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getAppointmentCopy } from "@/features/appointment/copy";

export type AppointmentType = "online_chat" | "video_call" | "in_person";

type UseAppointmentFormParams = {
  doctorId: number | null;
  sessionId: string;
  resolved: "en" | "zh";
  open: boolean;
  onBooked: () => void;
};

export function useAppointmentForm({
  doctorId,
  sessionId,
  resolved,
  open,
  onBooked,
}: UseAppointmentFormParams) {
  const t = getAppointmentCopy(resolved);
  const [bookingEmail, setBookingEmail] = useState("");
  const [bookingScheduledAt, setBookingScheduledAt] = useState("");
  const [bookingType, setBookingType] = useState<AppointmentType>("video_call");

  useEffect(() => {
    if (!open || !doctorId) return;

    const defaultDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const localIso = new Date(
      defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000
    )
      .toISOString()
      .slice(0, 16);
    setBookingScheduledAt(localIso);
  }, [open, doctorId]);

  const createAppointmentMutation = trpc.appointments.create.useMutation({
    onSuccess: result => {
      toast.success(t.bookingSuccess);
      onBooked();
      if (result.devLink && typeof window !== "undefined") {
        window.location.href = result.devLink;
      }
    },
    onError: error => {
      toast.error(error.message || t.bookingFailed);
    },
  });

  const handleCreateBooking = async () => {
    if (!doctorId || !bookingEmail.trim() || !bookingScheduledAt.trim()) {
      toast.error(t.bookingInvalid);
      return;
    }

    await createAppointmentMutation.mutateAsync({
      doctorId,
      appointmentType: bookingType,
      scheduledAt: new Date(bookingScheduledAt).toISOString(),
      email: bookingEmail.trim(),
      sessionId,
    });
  };

  return {
    bookingEmail,
    bookingScheduledAt,
    bookingType,
    createAppointmentMutation,
    setBookingEmail,
    setBookingScheduledAt,
    setBookingType,
    handleCreateBooking,
  };
}
