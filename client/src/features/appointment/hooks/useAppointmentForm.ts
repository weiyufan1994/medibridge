import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getOrCreateDeviceId } from "@/features/auth/deviceId";
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
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: open,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [bookingEmail, setBookingEmail] = useState("");
  const [bookingOtpCode, setBookingOtpCode] = useState("");
  const [otpRequestedEmail, setOtpRequestedEmail] = useState("");
  const [otpCooldownSeconds, setOtpCooldownSeconds] = useState(0);
  const [bookingScheduledAt, setBookingScheduledAt] = useState("");
  const [bookingType, setBookingType] = useState<AppointmentType>("video_call");
  const authenticatedEmail = meQuery.data?.email?.trim().toLowerCase() ?? "";
  const isLoggedInWithEmail = authenticatedEmail.length > 0;

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

  useEffect(() => {
    if (otpCooldownSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setOtpCooldownSeconds(current => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [otpCooldownSeconds]);

  useEffect(() => {
    if (!open) {
      setBookingOtpCode("");
      setOtpRequestedEmail("");
      setOtpCooldownSeconds(0);
    }
  }, [open]);

  useEffect(() => {
    if (isLoggedInWithEmail) {
      setBookingEmail(authenticatedEmail);
    }
  }, [authenticatedEmail, isLoggedInWithEmail]);

  const createAppointmentMutation = trpc.appointments.create.useMutation({
    onSuccess: async result => {
      toast.success(t.bookingSuccess);
      onBooked();
      if (typeof window !== "undefined") {
        window.location.href = result.checkoutUrl;
      }
    },
    onError: error => {
      toast.error(error.message || t.bookingFailed);
    },
  });

  const requestOtpMutation = trpc.auth.requestOtp.useMutation({
    onSuccess: () => {
      setOtpRequestedEmail(normalizedEmail);
      setBookingOtpCode("");
      setOtpCooldownSeconds(60);
      toast.success(t.bookingOtpSent);
    },
    onError: error => {
      toast.error(error.message || t.bookingIdentityVerifyFailed);
    },
  });

  const verifyOtpMutation = trpc.auth.verifyOtpAndMerge.useMutation({
    onError: error => {
      toast.error(error.message || t.bookingIdentityVerifyFailed);
    },
  });

  const normalizedEmail = bookingEmail.trim().toLowerCase();
  const createEmail = isLoggedInWithEmail ? authenticatedEmail : normalizedEmail;
  const requiresOtpFlow = !isLoggedInWithEmail;
  const otpRequested = otpRequestedEmail === normalizedEmail;
  const canRequestOtp =
    requiresOtpFlow &&
    normalizedEmail.length > 3 &&
    otpCooldownSeconds === 0 &&
    !requestOtpMutation.isPending &&
    !verifyOtpMutation.isPending &&
    !createAppointmentMutation.isPending;
  const isSubmitting =
    verifyOtpMutation.isPending || createAppointmentMutation.isPending;

  const handleCreateBooking = async () => {
    if (!doctorId || !createEmail || !bookingScheduledAt.trim()) {
      toast.error(t.bookingInvalid);
      return;
    }
    const normalizedSessionId =
      sessionId.trim().length > 0 ? sessionId.trim() : undefined;
    const triageSessionId = Number(normalizedSessionId ?? NaN);

    if (!Number.isInteger(triageSessionId) || triageSessionId <= 0) {
      toast.error(
        resolved === "zh"
          ? "请先完成 AI 分诊后再预约医生。"
          : "Please complete AI triage before booking a doctor."
      );
      return;
    }

    if (requiresOtpFlow) {
      if (bookingOtpCode.trim().length !== 6) {
        toast.error(t.bookingOtpRequired);
        return;
      }
      if (!otpRequested) {
        toast.error(t.bookingOtpRequired);
        return;
      }

      const deviceId = getOrCreateDeviceId();
      if (!deviceId) {
        toast.error(t.bookingDeviceIdMissing);
        return;
      }

      const bookingToastId = "appointment-booking";
      toast.loading(t.bookingVerifyingIdentity, { id: bookingToastId });

      try {
        await verifyOtpMutation.mutateAsync({
          email: normalizedEmail,
          code: bookingOtpCode.trim(),
          deviceId,
        });

        await utils.auth.me.invalidate();
        toast.message(t.bookingIdentityVerified, { id: bookingToastId });

        await createAppointmentMutation.mutateAsync({
          doctorId,
          triageSessionId,
          appointmentType: bookingType,
          scheduledAt: new Date(bookingScheduledAt).toISOString(),
          email: createEmail,
          sessionId: normalizedSessionId,
        });
      } catch {
        toast.dismiss(bookingToastId);
      }
      return;
    }
    await createAppointmentMutation.mutateAsync({
      doctorId,
      triageSessionId,
      appointmentType: bookingType,
      scheduledAt: new Date(bookingScheduledAt).toISOString(),
      email: createEmail,
      sessionId: normalizedSessionId,
    });
  };

  const handleRequestOtp = async () => {
    if (!canRequestOtp) {
      return;
    }
    await requestOtpMutation.mutateAsync({
      email: normalizedEmail,
    });
  };

  return {
    bookingEmail,
    bookingOtpCode,
    isLoggedInWithEmail,
    otpRequested,
    otpCooldownSeconds,
    requestOtpMutation,
    verifyOtpMutation,
    canRequestOtp,
    isSubmitting,
    bookingScheduledAt,
    bookingType,
    createAppointmentMutation,
    setBookingEmail,
    setBookingOtpCode,
    setBookingScheduledAt,
    setBookingType,
    handleRequestOtp,
    handleCreateBooking,
  };
}
