import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
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
  type AppointmentType,
} from "@/features/appointment/hooks/useAppointmentForm";
import { getAppointmentCopy } from "@/features/appointment/copy";

type AppointmentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: number | null;
  sessionId: string;
  resolved: "en" | "zh";
};

export function AppointmentModal({
  open,
  onOpenChange,
  doctorId,
  sessionId,
  resolved,
}: AppointmentModalProps) {
  const t = getAppointmentCopy(resolved);
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
    intake,
    setBookingEmail,
    setBookingOtpCode,
    setBookingScheduledAt,
    setBookingType,
    setIntake,
    handleRequestOtp,
    handleCreateBooking,
  } = useAppointmentForm({
    doctorId,
    sessionId,
    resolved,
    open,
    onBooked: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.bookingTitle}</DialogTitle>
          <DialogDescription>{t.bookingDesc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!isLoggedInWithEmail ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="booking-email">{t.bookingEmail}</Label>
                <Input
                  id="booking-email"
                  type="email"
                  value={bookingEmail}
                  onChange={event => setBookingEmail(event.target.value)}
                  placeholder={t.bookingEmailPlaceholder}
                  disabled={isSubmitting}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-full"
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
              <div className="space-y-1">
                <Label htmlFor="booking-otp">{t.bookingOtpLabel}</Label>
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
            </>
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {t.bookingEmail}: {bookingEmail}
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="booking-time">{t.bookingTime}</Label>
            <Input
              id="booking-time"
              type="datetime-local"
              value={bookingScheduledAt}
              onChange={event => setBookingScheduledAt(event.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="booking-type">{t.bookingType}</Label>
            <select
              id="booking-type"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={bookingType}
              onChange={event =>
                setBookingType(event.target.value as AppointmentType)
              }
              disabled={isSubmitting}
            >
              <option value="online_chat">{t.bookingTypeOnline}</option>
              <option value="video_call">{t.bookingTypeVideo}</option>
              <option value="in_person">{t.bookingTypeInPerson}</option>
            </select>
          </div>
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-medium">{t.intakeTitle}</p>
            <p className="text-xs text-slate-500">{t.intakeDesc}</p>
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
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="intake-medications">{t.intakeMedications}</Label>
              <Textarea
                id="intake-medications"
                value={intake.medications}
                onChange={event =>
                  setIntake(current => ({ ...current, medications: event.target.value }))
                }
                placeholder={t.intakePlaceholderMedications}
                rows={2}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="intake-allergies">{t.intakeAllergies}</Label>
              <Input
                id="intake-allergies"
                value={intake.allergies}
                onChange={event =>
                  setIntake(current => ({ ...current, allergies: event.target.value }))
                }
                placeholder={t.intakePlaceholderAllergies}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="intake-other-symptoms">{t.intakeOtherSymptoms}</Label>
              <Textarea
                id="intake-other-symptoms"
                value={intake.otherSymptoms}
                onChange={event =>
                  setIntake(current => ({ ...current, otherSymptoms: event.target.value }))
                }
                placeholder={t.intakePlaceholderOtherSymptoms}
                rows={2}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t.bookingCancel}
          </Button>
          <Button
            onClick={() => void handleCreateBooking()}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? t.bookingCreating
              : t.bookingConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
