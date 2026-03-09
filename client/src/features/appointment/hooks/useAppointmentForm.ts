import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getOrCreateDeviceId } from "@/features/auth/deviceId";
import { trpc } from "@/lib/trpc";
import { getAppointmentCopy } from "@/features/appointment/copy";
import {
  buildIntakeDefaultsFromTriage,
  EMPTY_APPOINTMENT_INTAKE,
  type AppointmentIntake,
  type TriagePrefillInput,
} from "@shared/appointmentIntake";

export type AppointmentType = "online_chat" | "video_call" | "in_person";
export type AppointmentPackageId =
  | "chat_quick_30m"
  | "chat_standard_60m"
  | "chat_extended_24h"
  | "video_quick_30m"
  | "video_standard_60m"
  | "inperson_standard_45m";

type UseAppointmentFormParams = {
  doctorId: number | null;
  sessionId: string;
  resolved: "en" | "zh";
  open: boolean;
  triagePrefill?: TriagePrefillInput;
  onBooked: () => void;
};

export function useAppointmentForm({
  doctorId,
  sessionId,
  resolved,
  open,
  triagePrefill,
  onBooked,
}: UseAppointmentFormParams) {
  const toLocalDateTimeValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hour}:${minute}`;
  };

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
  const [bookingType, setBookingType] = useState<AppointmentType>("online_chat");
  const [bookingPackageId, setBookingPackageId] =
    useState<AppointmentPackageId>("chat_standard_60m");
  const [intake, setIntake] = useState<AppointmentIntake>(() =>
    buildIntakeDefaultsFromTriage(triagePrefill)
  );
  const authenticatedEmail = meQuery.data?.email?.trim().toLowerCase() ?? "";
  const isLoggedInWithEmail = authenticatedEmail.length > 0;
  const packagesQuery = trpc.appointments.listPackages.useQuery(
    {
      appointmentType: bookingType,
    },
    {
      enabled: open,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  useEffect(() => {
    if (!open || !doctorId) return;

    const defaultDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setBookingScheduledAt(toLocalDateTimeValue(defaultDate));
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
      setBookingType("online_chat");
      setBookingPackageId("chat_standard_60m");
      setIntake({ ...EMPTY_APPOINTMENT_INTAKE });
      return;
    }
    setIntake(buildIntakeDefaultsFromTriage(triagePrefill));
  }, [open, triagePrefill]);

  useEffect(() => {
    if (isLoggedInWithEmail) {
      setBookingEmail(authenticatedEmail);
    }
  }, [authenticatedEmail, isLoggedInWithEmail]);

  useEffect(() => {
    const options = packagesQuery.data ?? [];
    if (options.length === 0) {
      return;
    }
    const selectedExists = options.some(option => option.id === bookingPackageId);
    if (selectedExists) {
      return;
    }
    const defaultOption = options.find(option => option.isDefault) ?? options[0];
    setBookingPackageId(defaultOption.id);
  }, [bookingPackageId, packagesQuery.data]);

  const createAppointmentMutation = trpc.appointments.createV2.useMutation({
    onSuccess: async result => {
      toast.success(t.bookingSuccess);
      onBooked();
      if (typeof window !== "undefined") {
        const isMockCheckoutEnabled = import.meta.env.MODE !== "production";
        if (isMockCheckoutEnabled && result.appointmentId > 0) {
          window.location.href = `/mock-checkout/${result.appointmentId}`;
          return;
        }
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
    if (!intake.chiefComplaint.trim()) {
      toast.error(t.bookingChiefComplaintRequired);
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
          packageId: bookingPackageId,
          scheduledAt: new Date(bookingScheduledAt).toISOString(),
          contact: {
            email: createEmail,
          },
          intake,
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
      packageId: bookingPackageId,
      scheduledAt: new Date(bookingScheduledAt).toISOString(),
      contact: {
        email: createEmail,
      },
      intake,
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
    bookingPackageId,
    packageOptions: packagesQuery.data ?? [],
    packagesLoading: packagesQuery.isLoading,
    intake,
    createAppointmentMutation,
    setBookingEmail,
    setBookingOtpCode,
    setBookingScheduledAt,
    setBookingType,
    setBookingPackageId,
    setIntake,
    handleRequestOtp,
    handleCreateBooking,
  };
}
