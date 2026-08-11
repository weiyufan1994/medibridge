import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAppointmentCopy } from "@/features/appointment/copy";
import type { UseAppointmentFormResult } from "@/features/appointment/hooks/useAppointmentForm";

type Props = {
  form: UseAppointmentFormResult;
  onToggleEditInfo: () => void;
  showEditInfo: boolean;
  t: ReturnType<typeof getAppointmentCopy>;
};

export function AppointmentIntakeStep({
  form,
  onToggleEditInfo,
  showEditInfo,
  t,
}: Props) {
  return (
    <div className="mt-6 space-y-4">
      {!form.isLoggedInWithEmail ? (
        <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <Label
            htmlFor="booking-email"
            className="text-sm font-medium text-slate-700"
          >
            {t.bookingEmail}
          </Label>
          <Input
            id="booking-email"
            type="email"
            value={form.bookingEmail}
            onChange={event => form.setBookingEmail(event.target.value)}
            placeholder={t.bookingEmailPlaceholder}
            disabled={form.isSubmitting}
            className="mt-2 border-slate-200"
          />

          <div className="mt-4 space-y-3">
            <Label className="text-sm font-medium text-slate-700">
              {t.bookingOtpLabel}
            </Label>
            <InputOTP
              maxLength={6}
              value={form.bookingOtpCode}
              onChange={form.setBookingOtpCode}
              disabled={form.isSubmitting}
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
              onClick={() => void form.handleRequestOtp()}
              disabled={!form.canRequestOtp}
            >
              {form.requestOtpMutation.isPending
                ? t.bookingSendingOtp
                : form.otpCooldownSeconds > 0
                  ? t.bookingOtpCooldown.replace(
                      "{seconds}",
                      String(form.otpCooldownSeconds)
                    )
                  : form.otpRequested
                    ? t.bookingResendOtp
                    : t.bookingSendOtp}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {t.bookingEmail}: {form.bookingEmail}
        </div>
      )}

      <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t.aiSummaryPreviewTitle}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t.aiSummaryPreviewDesc}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleEditInfo}
          >
            {showEditInfo ? t.hideEditInfo : t.editInfo}
          </Button>
        </div>

        <div className="mt-4 grid gap-3">
          <div>
            <Label htmlFor="intake-chief-complaint">
              {t.intakeChiefComplaint}
            </Label>
            <Textarea
              id="intake-chief-complaint"
              value={form.intake.chiefComplaint}
              onChange={event =>
                form.setIntake(current => ({
                  ...current,
                  chiefComplaint: event.target.value,
                }))
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
                  value={form.intake.duration}
                  onChange={event =>
                    form.setIntake(current => ({
                      ...current,
                      duration: event.target.value,
                    }))
                  }
                  placeholder={t.intakePlaceholderDuration}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="intake-medical-history">
                  {t.intakeMedicalHistory}
                </Label>
                <Textarea
                  id="intake-medical-history"
                  value={form.intake.medicalHistory}
                  onChange={event =>
                    form.setIntake(current => ({
                      ...current,
                      medicalHistory: event.target.value,
                    }))
                  }
                  placeholder={t.intakePlaceholderMedicalHistory}
                  className="mt-2 min-h-[88px]"
                />
              </div>
              <div>
                <Label htmlFor="intake-medications">
                  {t.intakeMedications}
                </Label>
                <Input
                  id="intake-medications"
                  value={form.intake.medications}
                  onChange={event =>
                    form.setIntake(current => ({
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
                  value={form.intake.allergies}
                  onChange={event =>
                    form.setIntake(current => ({
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
                  value={form.intake.ageGroup}
                  onChange={event =>
                    form.setIntake(current => ({
                      ...current,
                      ageGroup: event.target.value,
                    }))
                  }
                  placeholder={t.intakePlaceholderAgeGroup}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="intake-other-symptoms">
                  {t.intakeOtherSymptoms}
                </Label>
                <Textarea
                  id="intake-other-symptoms"
                  value={form.intake.otherSymptoms}
                  onChange={event =>
                    form.setIntake(current => ({
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
  );
}
