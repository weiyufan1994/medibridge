import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAppointmentForm,
  type AppointmentPackageId,
  type AppointmentType,
} from "@/features/appointment/hooks/useAppointmentForm";
import { getAppointmentCopy } from "@/features/appointment/copy";
import type { TriagePrefillInput } from "@shared/appointmentIntake";
import { trpc } from "@/lib/trpc";

type AppointmentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: number | null;
  sessionId: string;
  resolved: "en" | "zh";
  triagePrefill?: TriagePrefillInput;
};

const QUICK_TIME_SLOTS = ["09:00", "11:00", "14:00", "16:30", "18:00"];
const DEFAULT_CHINA_WINDOW_START_MINUTES = 9 * 60;
const DEFAULT_CHINA_WINDOW_END_MINUTES = 18 * 60;
const FULL_DAY_WINDOW_START_MINUTES = 0;
const FULL_DAY_WINDOW_END_MINUTES = 23 * 60 + 59;

const toBooleanEnv = (raw: string | undefined) => {
  if (!raw) return false;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
};

const parseDoctorIdList = (raw: string | undefined) => {
  if (!raw) return new Set<number>();
  return new Set(
    raw
      .split(",")
      .map(item => Number(item.trim()))
      .filter(item => Number.isInteger(item) && item > 0)
  );
};

const TEST_24H_DOCTOR_IDS = parseDoctorIdList(import.meta.env.VITE_TEST_24H_DOCTOR_IDS);
const FORCE_24H_ALL_DOCTORS = toBooleanEnv(import.meta.env.VITE_TEST_24H_ALL_DOCTORS);

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toHHmmFromMinutes = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const hours = String(Math.floor(safeMinutes / 60)).padStart(2, "0");
  const mins = String(safeMinutes % 60).padStart(2, "0");
  return `${hours}:${mins}`;
};

const HHMM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const getLocalTimeZone = () => {
  if (typeof Intl === "undefined") return "UTC";
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
};

const normalizeManualTimeInput = (raw: string) => {
  const cleaned = raw.replace(/[^\d:]/g, "");
  if (cleaned.includes(":")) {
    const [rawHour, rawMinute = ""] = cleaned.split(":", 2);
    const hour = rawHour.replace(/\D/g, "").slice(0, 2);
    const minute = rawMinute.replace(/\D/g, "").slice(0, 2);
    if (!hour) return "";
    if (hour.length === 1 && minute.length === 2) {
      return `0${hour}:${minute}`;
    }
    if (minute.length === 2) {
      return `${hour.padStart(2, "0")}:${minute}`;
    }
    return `${hour}:${minute}`;
  }

  const digits = cleaned.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  if (digits.length === 3) return `${digits.slice(0, 1)}:${digits.slice(1)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

const toCanonicalTime = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) return null;

  if (/^\d{1,2}$/.test(value)) {
    const hour = Number(value);
    if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;
    return `${String(hour).padStart(2, "0")}:00`;
  }

  if (/^\d{1,2}:\d{1,2}$/.test(value)) {
    const [rawHour, rawMinute] = value.split(":");
    const hour = Number(rawHour);
    const minute = Number(rawMinute);
    if (
      Number.isNaN(hour) ||
      Number.isNaN(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return null;
    }
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  if (/^\d{3,4}$/.test(value)) {
    const hourPart = value.length === 3 ? value.slice(0, 1) : value.slice(0, 2);
    const minutePart = value.length === 3 ? value.slice(1) : value.slice(2);
    return toCanonicalTime(`${hourPart}:${minutePart}`);
  }

  return null;
};

function useInstantChinaMirrorPreview(params: {
  datePart: string;
  manualTimeInput: string;
  chinaWindowStartMinutes: number;
  chinaWindowEndMinutes: number;
}) {
  const {
    datePart,
    manualTimeInput,
    chinaWindowStartMinutes,
    chinaWindowEndMinutes,
  } = params;
  return useMemo(() => {
    const canonicalTime = toCanonicalTime(manualTimeInput);
    if (!datePart || !canonicalTime || !HHMM_PATTERN.test(canonicalTime)) {
      return null;
    }

    const localTimeZone = getLocalTimeZone();
    const instant = fromZonedTime(`${datePart}T${canonicalTime}:00`, localTimeZone);
    if (Number.isNaN(instant.getTime())) {
      return null;
    }

    const chinaPreview = formatInTimeZone(instant, "Asia/Shanghai", "MM/dd HH:mm");
    const chinaHour = Number(formatInTimeZone(instant, "Asia/Shanghai", "HH"));
    const chinaMinute = Number(formatInTimeZone(instant, "Asia/Shanghai", "mm"));
    const chinaMinutes = chinaHour * 60 + chinaMinute;
    const isDoctorAvailable =
      chinaMinutes >= chinaWindowStartMinutes && chinaMinutes <= chinaWindowEndMinutes;
    const isExpired = instant.getTime() <= Date.now();

    return {
      chinaPreview,
      isDoctorAvailable,
      isExpired,
    };
  }, [datePart, manualTimeInput, chinaWindowEndMinutes, chinaWindowStartMinutes]);
}

type TimeValidationErrorKey =
  | "invalid_time"
  | "past_time_today"
  | "outside_working_hours";

export function AppointmentModal({
  open,
  onOpenChange,
  doctorId,
  sessionId,
  resolved,
  triagePrefill,
}: AppointmentModalProps) {
  const t = getAppointmentCopy(resolved);
  const [step, setStep] = useState<1 | 2>(1);
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [dateValidationError, setDateValidationError] = useState<string | null>(null);
  const [manualTimeInput, setManualTimeInput] = useState("");
  const [manualTimeErrorKey, setManualTimeErrorKey] = useState<TimeValidationErrorKey | null>(null);

  const {
    bookingEmail,
    bookingOtpCode,
    isLoggedInWithEmail,
    otpRequested,
    otpCooldownSeconds,
    requestOtpMutation,
    canRequestOtp,
    isSubmitting,
    bookingScheduledAt,
    bookingType,
    bookingPackageId,
    packageOptions,
    packagesLoading,
    intake,
    setBookingEmail,
    setBookingOtpCode,
    setBookingScheduledAt,
    setBookingType,
    setBookingPackageId,
    setIntake,
    handleRequestOtp,
    handleCreateBooking,
  } = useAppointmentForm({
    doctorId,
    sessionId,
    resolved,
    open,
    triagePrefill,
    onBooked: () => onOpenChange(false),
  });

  const doctorQuery = trpc.doctors.getById.useQuery(
    { id: doctorId ?? 0 },
    { enabled: open && !!doctorId }
  );

  useEffect(() => {
    if (!open) {
      setStep(1);
      setShowEditInfo(false);
      setDateValidationError(null);
      setManualTimeErrorKey(null);
    }
  }, [open]);

  const selectedPackage = packageOptions.find(option => option.id === bookingPackageId);
  const selectedDate = bookingScheduledAt.includes("T")
    ? bookingScheduledAt.slice(0, 10)
    : "";
  const selectedTime = bookingScheduledAt.includes("T")
    ? bookingScheduledAt.slice(11, 16)
    : "";

  const localTodayStart = new Date();
  localTodayStart.setHours(0, 0, 0, 0);
  const localTimeZone = getLocalTimeZone();
  const todayLocalDate = formatLocalDate(localTodayStart);
  const activeDatePart = selectedDate || todayLocalDate;
  const isTwentyFourHourDoctor =
    FORCE_24H_ALL_DOCTORS || (doctorId !== null && TEST_24H_DOCTOR_IDS.has(doctorId));
  const chinaWindowStartMinutes = isTwentyFourHourDoctor
    ? FULL_DAY_WINDOW_START_MINUTES
    : DEFAULT_CHINA_WINDOW_START_MINUTES;
  const chinaWindowEndMinutes = isTwentyFourHourDoctor
    ? FULL_DAY_WINDOW_END_MINUTES
    : DEFAULT_CHINA_WINDOW_END_MINUTES;

  const upsertDateTime = (datePart: string, timePart: string) => {
    if (!datePart || !timePart) return;
    setBookingScheduledAt(`${datePart}T${timePart}`);
  };

  const validateSelectedTime = useMemo(
    () =>
      (datePart: string, rawTime: string): { isValid: boolean; errorKey: TimeValidationErrorKey | null } => {
        const value = toCanonicalTime(rawTime);
        if (!value || !/^\d{2}:\d{2}$/.test(value)) {
          return {
            isValid: false,
            errorKey: "invalid_time",
          };
        }

        const [hour, minute] = value.split(":").map(Number);
        if (
          Number.isNaN(hour) ||
          Number.isNaN(minute) ||
          hour < 0 ||
          hour > 23 ||
          minute < 0 ||
          minute > 59
        ) {
          return {
            isValid: false,
            errorKey: "invalid_time",
          };
        }

        const localTimeZone = getLocalTimeZone();
        const instant = fromZonedTime(`${datePart}T${value}:00`, localTimeZone);
        if (Number.isNaN(instant.getTime())) {
          return {
            isValid: false,
            errorKey: "invalid_time",
          };
        }

        if (datePart === todayLocalDate && instant.getTime() <= Date.now()) {
          return {
            isValid: false,
            errorKey: "past_time_today",
          };
        }

        const chinaHour = Number(formatInTimeZone(instant, "Asia/Shanghai", "HH"));
        const chinaMinute = Number(formatInTimeZone(instant, "Asia/Shanghai", "mm"));
        const chinaMinutes = chinaHour * 60 + chinaMinute;
        if (chinaMinutes < chinaWindowStartMinutes || chinaMinutes > chinaWindowEndMinutes) {
          return {
            isValid: false,
            errorKey: "outside_working_hours",
          };
        }

        return { isValid: true, errorKey: null };
      },
    [chinaWindowEndMinutes, chinaWindowStartMinutes, todayLocalDate]
  );

  const handleDateChange = (datePart: string) => {
    if (datePart < todayLocalDate) {
      const message = t.bookingPastDate;
      setDateValidationError(message);
      toast.error(message);
      return;
    }

    setDateValidationError(null);

    const timeCandidates = Array.from(
      new Set(
        [
          toCanonicalTime(manualTimeInput),
          toCanonicalTime(selectedTime),
          ...QUICK_TIME_SLOTS,
        ].filter((value): value is string => Boolean(value))
      )
    );

    const firstValidTime = timeCandidates.find(time =>
      validateSelectedTime(datePart, time).isValid
    );
    const fallbackTime = firstValidTime || timeCandidates[0] || "09:00";

    if (fallbackTime !== manualTimeInput) {
      setManualTimeInput(fallbackTime);
    }
    upsertDateTime(datePart, fallbackTime);

    const validation = validateSelectedTime(datePart, fallbackTime);
    setManualTimeErrorKey(validation.errorKey);
  };

  const handleManualTimeInputChange = (rawValue: string) => {
    const normalized = normalizeManualTimeInput(rawValue);
    setManualTimeInput(normalized);

    const canonicalTime = toCanonicalTime(normalized);
    if (!canonicalTime || !HHMM_PATTERN.test(canonicalTime)) {
      const looksLikeCompleteTime = normalized.includes(":") && normalized.length >= 4;
      setManualTimeErrorKey(looksLikeCompleteTime ? "invalid_time" : null);
      return;
    }

    const targetDate = activeDatePart;
    const validation = validateSelectedTime(targetDate, canonicalTime);
    if (!validation.isValid) {
      setManualTimeErrorKey(validation.errorKey);
      return;
    }

    setManualTimeErrorKey(null);
    upsertDateTime(targetDate, canonicalTime);
  };

  const handleQuickSlotSelect = (slot: string) => {
    handleManualTimeInputChange(slot);
  };

  const canContinueStep2 =
    Boolean(toCanonicalTime(manualTimeInput)) &&
    bookingPackageId.trim().length > 0 &&
    bookingType.trim().length > 0 &&
    !manualTimeErrorKey;

  const handlePrimaryAction = async () => {
    if (step === 1) {
      const canonicalTime = toCanonicalTime(manualTimeInput);
      if (!canonicalTime) {
        setManualTimeErrorKey("invalid_time");
        return;
      }

      if (canonicalTime !== manualTimeInput) {
        setManualTimeInput(canonicalTime);
      }

      const validation = validateSelectedTime(activeDatePart, canonicalTime);
      if (!validation.isValid) {
        setManualTimeErrorKey(validation.errorKey);
        return;
      }

      setManualTimeErrorKey(null);
      upsertDateTime(activeDatePart, canonicalTime);
      if (bookingPackageId.trim().length === 0 || bookingType.trim().length === 0) {
        return;
      }
      setStep(2);
      return;
    }
    await handleCreateBooking();
  };

  const doctorName =
    (resolved === "zh"
      ? doctorQuery.data?.doctor.name
      : doctorQuery.data?.doctor.nameEn || doctorQuery.data?.doctor.name) ||
    t.doctorFallback;
  const doctorDepartment =
    resolved === "zh"
      ? doctorQuery.data?.department.name
      : doctorQuery.data?.department.nameEn || doctorQuery.data?.department.name;
  const doctorTitle =
    resolved === "zh"
      ? doctorQuery.data?.doctor.title
      : doctorQuery.data?.doctor.titleEn || doctorQuery.data?.doctor.title;
  const instantChinaMirror = useInstantChinaMirrorPreview({
    datePart: activeDatePart,
    manualTimeInput,
    chinaWindowStartMinutes,
    chinaWindowEndMinutes,
  });
  const localDoctorWindowRange = useMemo(() => {
    const windowStart = fromZonedTime(
      `${activeDatePart}T${toHHmmFromMinutes(chinaWindowStartMinutes)}:00`,
      "Asia/Shanghai"
    );
    const windowEnd = fromZonedTime(
      `${activeDatePart}T${toHHmmFromMinutes(chinaWindowEndMinutes)}:00`,
      "Asia/Shanghai"
    );
    const startLabel = formatInTimeZone(windowStart, localTimeZone, "HH:mm");
    const endLabel = formatInTimeZone(windowEnd, localTimeZone, "HH:mm");
    return `${startLabel} - ${endLabel}`;
  }, [activeDatePart, chinaWindowEndMinutes, chinaWindowStartMinutes, localTimeZone]);
  const canonicalManualTime = toCanonicalTime(manualTimeInput);
  const hasCompleteManualTime = Boolean(canonicalManualTime && HHMM_PATTERN.test(canonicalManualTime));
  const isTimeValid = hasCompleteManualTime && manualTimeErrorKey === null;
  const isTimeInvalid = manualTimeErrorKey !== null;
  const unifiedFeedback = useMemo(() => {
    if (manualTimeErrorKey === "invalid_time") {
      return { text: t.bookingInvalidFormat, className: "text-red-500" };
    }

    if (manualTimeErrorKey === "outside_working_hours") {
      return {
        text: t.bookingOutOfHours,
        className: "text-red-500",
      };
    }

    if (manualTimeErrorKey === "past_time_today") {
      return { text: t.bookingPastTimeToday, className: "text-red-500" };
    }

    if (isTimeValid) {
      return {
        text: t.doctorAvailableRangeHint.replace("{range}", localDoctorWindowRange),
        className: "text-emerald-600",
      };
    }

    return {
      text: t.doctorAvailableRangeHint.replace("{range}", localDoctorWindowRange),
      className: "text-slate-500",
    };
  }, [isTimeValid, localDoctorWindowRange, manualTimeErrorKey, t]);

  useEffect(() => {
    if (!manualTimeInput) {
      setManualTimeErrorKey(null);
      return;
    }

    const canonicalTime = toCanonicalTime(manualTimeInput);
    if (!canonicalTime || !HHMM_PATTERN.test(canonicalTime)) {
      const looksLikeCompleteTime = manualTimeInput.includes(":") && manualTimeInput.length >= 4;
      setManualTimeErrorKey(looksLikeCompleteTime ? "invalid_time" : null);
      return;
    }

    const validation = validateSelectedTime(activeDatePart, canonicalTime);
    setManualTimeErrorKey(validation.errorKey);
    if (validation.isValid) {
      upsertDateTime(activeDatePart, canonicalTime);
    }
  }, [activeDatePart, manualTimeInput, validateSelectedTime]);

  useEffect(() => {
    if (!selectedTime) {
      setManualTimeInput("");
      return;
    }
    setManualTimeInput(selectedTime);
  }, [selectedTime]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-0 bg-white rounded-3xl p-0 shadow-2xl overflow-hidden flex max-h-[90vh] flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-slate-100">
          <DialogTitle>{step === 1 ? t.step1Title : t.step2Title}</DialogTitle>
          <DialogDescription>
            {step === 1 ? t.step1Desc : t.step2Desc}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-6 py-4 space-y-4 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent">
          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={doctorQuery.data?.doctor.imageUrl ?? undefined}
                    alt={doctorName}
                  />
                  <AvatarFallback>{doctorName.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{doctorName}</p>
                  <p className="text-xs text-slate-600 truncate">
                    {[doctorTitle, doctorDepartment].filter(Boolean).join(" · ") || "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {step === 1 ? (
            <div className="space-y-1">
              {!isLoggedInWithEmail ? (
                <div className="rounded-xl border border-slate-200/70 p-2.5 space-y-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    {t.bookingEmail}
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="booking-email">{t.bookingEmail}</Label>
                    <Input
                      id="booking-email"
                      type="email"
                      value={bookingEmail}
                      onChange={event => setBookingEmail(event.target.value)}
                      onKeyDown={event => {
                        if (
                          event.key === "Enter" &&
                          !event.nativeEvent.isComposing &&
                          canRequestOtp
                        ) {
                          event.preventDefault();
                          void handleRequestOtp();
                        }
                      }}
                      placeholder={t.bookingEmailPlaceholder}
                      disabled={isSubmitting}
                      className="border-0 border-b border-slate-200 rounded-none px-0 focus-visible:ring-0 focus-visible:border-teal-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="booking-otp">{t.bookingOtpLabel}</Label>
                    <div
                      onKeyDown={event => {
                        if (
                          event.key === "Enter" &&
                          !event.nativeEvent.isComposing &&
                          bookingOtpCode.length === 6
                        ) {
                          event.preventDefault();
                          void handlePrimaryAction();
                        }
                      }}
                    >
                      <InputOTP
                        id="booking-otp"
                        maxLength={6}
                        value={bookingOtpCode}
                        onChange={setBookingOtpCode}
                        containerClassName="justify-start"
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => void handleRequestOtp()}
                      disabled={!canRequestOtp}
                    >
                      {requestOtpMutation.isPending
                        ? t.bookingSendingOtp
                        : otpCooldownSeconds > 0
                          ? t.bookingOtpCooldown.replace(
                              "{seconds}",
                              String(otpCooldownSeconds)
                            )
                          : otpRequested
                            ? t.bookingResendOtp
                            : t.bookingSendOtp}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {t.bookingEmail}: {bookingEmail}
                </div>
              )}

              <div className="rounded-xl border border-slate-200/70 p-2 space-y-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {t.bookingTime}
                </p>
                <div className="rounded-xl bg-slate-50 p-1.5">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Calendar className="h-4 w-4 text-teal-600" />
                    {t.selectDate}
                  </div>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={event => handleDateChange(event.target.value)}
                    disabled={isSubmitting}
                    min={todayLocalDate}
                    className="border-0 border-b border-slate-200 rounded-none px-0 focus-visible:ring-0 focus-visible:border-teal-500"
                  />
                  {dateValidationError ? (
                    <p className="mt-1 text-xs text-rose-600">{dateValidationError}</p>
                  ) : null}
                  <div className="mt-1.5 space-y-1">
                    <div>
                      <p className="mb-1 text-xs font-medium text-slate-500">
                        {t.quickSlotsLabel}
                      </p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {QUICK_TIME_SLOTS.map(slot => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => handleQuickSlotSelect(slot)}
                            disabled={isSubmitting}
                            className={`rounded-lg border px-2 py-1.5 text-xs transition ${
                              manualTimeInput === slot
                                ? "border-teal-600 bg-teal-50 text-teal-700"
                                : "border-slate-200 bg-white text-slate-700 hover:border-teal-300"
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Label
                      htmlFor="local-time-input"
                      className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2"
                    >
                      {t.bookingLocalTime}
                    </Label>
                    <Input
                      id="local-time-input"
                      value={manualTimeInput}
                      onChange={event => handleManualTimeInputChange(event.target.value)}
                      onBlur={() => {
                        const canonicalTime = toCanonicalTime(manualTimeInput);
                        if (!canonicalTime || !HHMM_PATTERN.test(canonicalTime)) {
                          setManualTimeErrorKey("invalid_time");
                          return;
                        }
                        if (canonicalTime !== manualTimeInput) {
                          setManualTimeInput(canonicalTime);
                        }
                        const targetDate = selectedDate || todayLocalDate;
                        const validation = validateSelectedTime(targetDate, canonicalTime);
                        setManualTimeErrorKey(validation.errorKey);
                        if (validation.isValid) {
                          upsertDateTime(targetDate, canonicalTime);
                        }
                      }}
                      placeholder="HH:mm"
                      disabled={isSubmitting}
                      className={`h-9 rounded-xl bg-white focus-visible:ring-2 focus-visible:ring-teal-500 ${
                        manualTimeErrorKey ? "border-red-500" : "border-slate-200"
                      }`}
                    />
                    <p className="text-xs font-mono text-slate-600">
                      {t.chinaMirrorPrefix} {instantChinaMirror?.chinaPreview ?? t.chinaMirrorPending}
                    </p>
                    <p className={`text-xs ${unifiedFeedback.className}`}>{unifiedFeedback.text}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/70 p-3 space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {t.bookingType}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["online_chat", t.bookingTypeOnline],
                      ["video_call", t.bookingTypeVideo],
                    ] as Array<[AppointmentType, string]>
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBookingType(value)}
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        bookingType === value
                          ? "border-teal-600 bg-teal-50 text-teal-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-teal-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/70 p-3 space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {t.bookingPackage}
                </p>
                <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent">
                  {packageOptions.map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setBookingPackageId(option.id as AppointmentPackageId)}
                      disabled={isSubmitting || packagesLoading}
                      className={`w-full rounded-xl border px-3 py-2 text-left ${
                        bookingPackageId === option.id
                          ? "border-teal-600 bg-teal-50"
                          : "border-slate-200 bg-white hover:border-teal-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {resolved === "zh" ? option.titleZh : option.titleEn}
                        </p>
                        <p className="text-xs font-medium text-slate-700 whitespace-nowrap">
                          {(option.amount / 100).toFixed(2)} {option.currency.toUpperCase()}
                        </p>
                      </div>
                      <p className="mt-1 line-clamp-1 text-[11px] text-slate-600">
                        {resolved === "zh" ? option.descriptionZh : option.descriptionEn}
                      </p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  {selectedPackage
                    ? resolved === "zh"
                      ? selectedPackage.descriptionZh
                      : selectedPackage.descriptionEn
                    : t.bookingPackageFallback}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{t.aiSummaryPreviewTitle}</p>
                <p className="mt-1 text-xs text-slate-500">{t.aiSummaryPreviewDesc}</p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p><span className="font-medium">{t.intakeChiefComplaint}: </span>{intake.chiefComplaint || "-"}</p>
                  <p><span className="font-medium">{t.intakeMedicalHistory}: </span>{intake.medicalHistory || "-"}</p>
                  <p><span className="font-medium">{t.intakeAgeGroup}: </span>{intake.ageGroup || "-"}</p>
                </div>
                <button
                  type="button"
                  className="mt-3 text-xs font-medium text-teal-600 hover:underline"
                  onClick={() => setShowEditInfo(current => !current)}
                >
                  {showEditInfo ? t.hideEditInfo : t.editInfo}
                </button>
              </div>

              {showEditInfo ? (
                <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                  <div className="space-y-1">
                    <Label htmlFor="intake-chief-complaint">{t.intakeChiefComplaint}</Label>
                    <Textarea
                      id="intake-chief-complaint"
                      value={intake.chiefComplaint}
                      onChange={event =>
                        setIntake(current => ({ ...current, chiefComplaint: event.target.value }))
                      }
                      placeholder={t.intakePlaceholderChiefComplaint}
                      rows={2}
                      disabled={isSubmitting}
                      className="border-0 border-b border-slate-200 rounded-none bg-white/60 px-0 focus-visible:ring-0 focus-visible:border-teal-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="intake-duration">{t.intakeDuration}</Label>
                      <Input
                        id="intake-duration"
                        value={intake.duration}
                        onChange={event =>
                          setIntake(current => ({ ...current, duration: event.target.value }))
                        }
                        placeholder={t.intakePlaceholderDuration}
                        disabled={isSubmitting}
                        className="border-0 border-b border-slate-200 rounded-none px-0 focus-visible:ring-0 focus-visible:border-teal-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="intake-age-group">{t.intakeAgeGroup}</Label>
                      <Input
                        id="intake-age-group"
                        value={intake.ageGroup}
                        onChange={event =>
                          setIntake(current => ({ ...current, ageGroup: event.target.value }))
                        }
                        placeholder={t.intakePlaceholderAgeGroup}
                        disabled={isSubmitting}
                        className="border-0 border-b border-slate-200 rounded-none px-0 focus-visible:ring-0 focus-visible:border-teal-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="intake-medical-history">{t.intakeMedicalHistory}</Label>
                    <Textarea
                      id="intake-medical-history"
                      value={intake.medicalHistory}
                      onChange={event =>
                        setIntake(current => ({ ...current, medicalHistory: event.target.value }))
                      }
                      placeholder={t.intakePlaceholderMedicalHistory}
                      rows={2}
                      disabled={isSubmitting}
                      className="border-0 border-b border-slate-200 rounded-none bg-white/60 px-0 focus-visible:ring-0 focus-visible:border-teal-500"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/75 px-6 py-4 sticky bottom-0">
          <Button
            variant="outline"
            onClick={() => {
              if (step === 2) {
                setStep(1);
                return;
              }
              onOpenChange(false);
            }}
            disabled={isSubmitting}
            className="gap-1"
          >
            {step === 2 ? <ChevronLeft className="h-4 w-4" /> : null}
            {step === 2 ? t.backStep : t.bookingCancel}
          </Button>
          <Button
            onClick={() => void handlePrimaryAction()}
            disabled={isSubmitting || (step === 1 && (isTimeInvalid || !canContinueStep2))}
            className="bg-teal-600 hover:bg-teal-700 gap-1"
          >
            {isSubmitting
              ? t.bookingCreating
              : step === 1
                ? t.continueStep
                : t.doctorDetailConfirmBook}
            {step === 1 ? <ChevronRight className="h-4 w-4" /> : null}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
