import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock3 } from "lucide-react";
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
import { buildSlotGroups } from "@/features/appointment/utils/slotDates";
import { getLocalizedText, getLocalizedTextWithZhFallback } from "@/lib/i18n";
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

type SlotItem = {
  id: number;
  doctorId: number;
  appointmentType: AppointmentType;
  slotDurationMinutes: number;
  timezone: string;
  localDate: string;
  startAt: Date;
  endAt: Date;
  status: "open" | "held" | "booked" | "blocked" | "expired";
  source: "rule" | "manual";
};

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatSlotLabel(date: Date, locale: "en" | "zh") {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatSlotRange(slot: SlotItem, locale: "en" | "zh") {
  return `${formatSlotLabel(slot.startAt, locale)} - ${formatSlotLabel(slot.endAt, locale)}`;
}

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
  const [selectedDate, setSelectedDate] = useState("");

  const {
    bookingSlotId,
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
    setBookingSlotId,
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

  const slotQuery = trpc.scheduling.listAvailableSlots.useQuery(
    {
      doctorId: doctorId ?? 0,
      appointmentType: bookingType,
    },
    {
      enabled: open && !!doctorId,
    }
  );

  useEffect(() => {
    if (!open) {
      setStep(1);
      setShowEditInfo(false);
      setSelectedDate("");
    }
  }, [open]);

  const slots = useMemo(() => {
    const rows = (slotQuery.data ?? []) as SlotItem[];
    return rows.filter(slot => slot.appointmentType === bookingType);
  }, [bookingType, slotQuery.data]);

  const slotGroups = useMemo(() => buildSlotGroups(slots), [slots]);
  const availableDates = useMemo(() => Array.from(slotGroups.keys()).sort(), [slotGroups]);
  const activeDate = selectedDate || availableDates[0] || formatDateInput(new Date());
  const activeSlots = slotGroups.get(activeDate) ?? [];

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!selectedDate && availableDates.length > 0) {
      setSelectedDate(availableDates[0]!);
    }
  }, [availableDates, open, selectedDate]);

  useEffect(() => {
    if (!bookingSlotId) {
      return;
    }

    const selectedStillVisible = slots.some(slot => slot.id === bookingSlotId);
    if (!selectedStillVisible) {
      setBookingSlotId(null);
      setBookingScheduledAt("");
    }
  }, [bookingSlotId, setBookingScheduledAt, setBookingSlotId, slots]);

  const selectedPackage = packageOptions.find(option => option.id === bookingPackageId);
  const selectedDoctor = doctorQuery.data?.doctor ?? null;
  const selectedSlot = slots.find(slot => slot.id === bookingSlotId) ?? null;

  const handleSlotSelect = (slot: SlotItem) => {
    setBookingSlotId(slot.id);
    setBookingScheduledAt(slot.startAt.toISOString());
  };

  const handleContinue = () => {
    if (!selectedSlot || !selectedPackage) {
      toast.error(t.bookingInvalid);
      return;
    }
    setStep(2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,980px)] max-w-2xl overflow-hidden rounded-3xl border-0 bg-white p-0 shadow-2xl">
        <div className="flex max-h-[min(92vh,980px)] flex-col">
          <div className="flex-1 overflow-y-auto bg-gradient-to-br from-teal-50 via-white to-slate-100 p-6 md:p-8">
            <DialogHeader className="space-y-3 text-left">
              <div className="inline-flex w-fit items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-teal-700 shadow-sm ring-1 ring-teal-100">
                {step === 1 ? t.step1Title : t.step2Title}
              </div>
              <DialogTitle className="text-2xl font-semibold text-slate-900">
                {t.bookingTitle}
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-slate-600">
                {step === 1 ? t.step1Desc : t.step2Desc}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t.doctorCardTitle}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Avatar className="h-12 w-12 ring-2 ring-white">
                  <AvatarImage src={selectedDoctor?.imageUrl ?? undefined} />
                  <AvatarFallback className="bg-teal-600 text-white">
                    {(
                      getLocalizedTextWithZhFallback({
                        lang: resolved,
                        value: selectedDoctor?.name,
                        placeholder: t.doctorFallback.replace("{{id}}", String(doctorId ?? "")),
                      }) ?? t.doctorFallback.replace("{{id}}", String(doctorId ?? ""))
                    )
                      .slice(0, 1)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {selectedDoctor
                      ? getLocalizedTextWithZhFallback({
                          lang: resolved,
                          value: selectedDoctor.name,
                          placeholder: t.doctorFallback.replace("{{id}}", String(doctorId ?? "")),
                        })
                      : t.doctorFallback.replace("{{id}}", String(doctorId ?? ""))}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {selectedDoctor
                      ? getLocalizedTextWithZhFallback({
                          lang: resolved,
                          value: selectedDoctor.title,
                          placeholder: t.bookingTypeOnline,
                        })
                      : t.bookingTypeOnline}
                  </p>
                </div>
              </div>
            </div>

            {step === 1 ? (
              <div className="mt-6 space-y-5">
                <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Calendar className="h-4 w-4 text-teal-600" />
                    {t.selectDate}
                  </div>
                  <Input
                    type="date"
                    value={activeDate}
                    onChange={event => setSelectedDate(event.target.value)}
                    min={formatDateInput(new Date())}
                    disabled={isSubmitting || slotQuery.isLoading}
                    className="mt-3 border-slate-200"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    {selectedSlot
                      ? `${t.bookingTime}: ${formatSlotRange(selectedSlot, resolved)}`
                      : t.slotSelectionHint}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Clock3 className="h-4 w-4 text-teal-600" />
                    {t.availableSlots}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {activeSlots.map(slot => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => handleSlotSelect(slot)}
                        disabled={isSubmitting}
                        className={`rounded-2xl border px-3 py-2 text-left text-sm transition ${
                          bookingSlotId === slot.id
                            ? "border-teal-600 bg-teal-50 text-teal-800"
                            : "border-slate-200 bg-white text-slate-700 hover:border-teal-300"
                        }`}
                      >
                        <div className="font-medium">{formatSlotRange(slot, resolved)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {slot.slotDurationMinutes} min
                        </div>
                      </button>
                    ))}
                  </div>
                  {!slotQuery.isLoading && activeSlots.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">
                      {t.noSellableSlots}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {t.bookingType}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(
                      [
                        ["online_chat", t.bookingTypeOnline],
                        ["video_call", t.bookingTypeVideo],
                      ] as Array<[AppointmentType, string]>
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setBookingType(value);
                          setBookingSlotId(null);
                          setBookingScheduledAt("");
                        }}
                        className={`rounded-2xl border px-3 py-2 text-sm ${
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

                <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {t.bookingPackage}
                  </p>
                  <div className="mt-3 space-y-2">
                    {packageOptions.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setBookingPackageId(option.id as AppointmentPackageId)}
                        disabled={isSubmitting || packagesLoading}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                          bookingPackageId === option.id
                            ? "border-teal-600 bg-teal-50"
                            : "border-slate-200 bg-white hover:border-teal-300"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">
                              {getLocalizedText({ lang: resolved, value: option.title })}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {getLocalizedText({
                                lang: resolved,
                                value: option.description,
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">
                              ${(option.amount / 100).toFixed(0)}
                            </p>
                            <p className="text-xs text-slate-500">{option.durationMinutes} min</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {!isLoggedInWithEmail ? (
                  <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
                    <Label htmlFor="booking-email" className="text-sm font-medium text-slate-700">
                      {t.bookingEmail}
                    </Label>
                    <Input
                      id="booking-email"
                      type="email"
                      value={bookingEmail}
                      onChange={event => setBookingEmail(event.target.value)}
                      placeholder={t.bookingEmailPlaceholder}
                      disabled={isSubmitting}
                      className="mt-2 border-slate-200"
                    />

                    <div className="mt-4 space-y-3">
                      <Label className="text-sm font-medium text-slate-700">
                        {t.bookingOtpLabel}
                      </Label>
                      <InputOTP
                        maxLength={6}
                        value={bookingOtpCode}
                        onChange={value => setBookingOtpCode(value)}
                        disabled={isSubmitting}
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
                            ? t.bookingOtpCooldown.replace("{seconds}", String(otpCooldownSeconds))
                            : otpRequested
                              ? t.bookingResendOtp
                              : t.bookingSendOtp}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {t.bookingEmail}: {bookingEmail}
                  </div>
                )}

                <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {t.aiSummaryPreviewTitle}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{t.aiSummaryPreviewDesc}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowEditInfo(current => !current)}
                    >
                      {showEditInfo ? t.hideEditInfo : t.editInfo}
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div>
                      <Label htmlFor="intake-chief-complaint">{t.intakeChiefComplaint}</Label>
                      <Textarea
                        id="intake-chief-complaint"
                        value={intake.chiefComplaint}
                        onChange={event =>
                          setIntake(current => ({ ...current, chiefComplaint: event.target.value }))
                        }
                        placeholder={t.intakePlaceholderChiefComplaint}
                        className="mt-2 min-h-[88px]"
                      />
                    </div>

                    {showEditInfo ? (
                      <>
                        <div>
                          <Label htmlFor="intake-duration">{t.intakeDuration}</Label>
                          <Input
                            id="intake-duration"
                            value={intake.duration}
                            onChange={event =>
                              setIntake(current => ({ ...current, duration: event.target.value }))
                            }
                            placeholder={t.intakePlaceholderDuration}
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label htmlFor="intake-medical-history">{t.intakeMedicalHistory}</Label>
                          <Textarea
                            id="intake-medical-history"
                            value={intake.medicalHistory}
                            onChange={event =>
                              setIntake(current => ({
                                ...current,
                                medicalHistory: event.target.value,
                              }))
                            }
                            placeholder={t.intakePlaceholderMedicalHistory}
                            className="mt-2 min-h-[88px]"
                          />
                        </div>
                        <div>
                          <Label htmlFor="intake-medications">{t.intakeMedications}</Label>
                          <Input
                            id="intake-medications"
                            value={intake.medications}
                            onChange={event =>
                              setIntake(current => ({
                                ...current,
                                medications: event.target.value,
                              }))
                            }
                            placeholder={t.intakePlaceholderMedications}
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label htmlFor="intake-allergies">{t.intakeAllergies}</Label>
                          <Input
                            id="intake-allergies"
                            value={intake.allergies}
                            onChange={event =>
                              setIntake(current => ({
                                ...current,
                                allergies: event.target.value,
                              }))
                            }
                            placeholder={t.intakePlaceholderAllergies}
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label htmlFor="intake-age-group">{t.intakeAgeGroup}</Label>
                          <Input
                            id="intake-age-group"
                            value={intake.ageGroup}
                            onChange={event =>
                              setIntake(current => ({
                                ...current,
                                ageGroup: event.target.value,
                              }))
                            }
                            placeholder={t.intakePlaceholderAgeGroup}
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label htmlFor="intake-other-symptoms">{t.intakeOtherSymptoms}</Label>
                          <Textarea
                            id="intake-other-symptoms"
                            value={intake.otherSymptoms}
                            onChange={event =>
                              setIntake(current => ({
                                ...current,
                                otherSymptoms: event.target.value,
                              }))
                            }
                            placeholder={t.intakePlaceholderOtherSymptoms}
                            className="mt-2 min-h-[88px]"
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>

            <div className="border-t border-slate-200/80 bg-white/95 p-6 backdrop-blur md:p-8">
              <DialogFooter className="flex-col gap-3 sm:flex-col">
                {step === 1 ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => onOpenChange(false)}
                    >
                      {t.bookingCancel}
                    </Button>
                    <Button
                      type="button"
                      className="w-full bg-teal-600 text-white hover:bg-teal-500"
                      onClick={handleContinue}
                      disabled={!selectedSlot || !selectedPackage || slotQuery.isLoading}
                    >
                      {t.continueStep}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setStep(1)}
                      disabled={isSubmitting}
                    >
                      {t.backStep}
                    </Button>
                    <Button
                      type="button"
                      className="w-full bg-teal-600 text-white hover:bg-teal-500"
                      onClick={() => void handleCreateBooking()}
                      disabled={isSubmitting || !bookingSlotId || !bookingScheduledAt}
                    >
                      {isSubmitting ? t.bookingCreating : t.doctorDetailConfirmBook}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
