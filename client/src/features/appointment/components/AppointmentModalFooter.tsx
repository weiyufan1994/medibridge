import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { getAppointmentCopy } from "@/features/appointment/copy";
import type { UseAppointmentFormResult } from "@/features/appointment/hooks/useAppointmentForm";

type Props = {
  canContinue: boolean;
  form: UseAppointmentFormResult;
  onBack: () => void;
  onCancel: () => void;
  onContinue: () => void;
  slotsLoading: boolean;
  step: 1 | 2;
  t: ReturnType<typeof getAppointmentCopy>;
};

export function AppointmentModalFooter({
  canContinue,
  form,
  onBack,
  onCancel,
  onContinue,
  slotsLoading,
  step,
  t,
}: Props) {
  return (
    <div className="border-t border-slate-200/80 bg-white/95 p-6 backdrop-blur md:p-8">
      <DialogFooter className="flex-col gap-3 sm:flex-col">
        {step === 1 ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onCancel}
            >
              {t.bookingCancel}
            </Button>
            <Button
              type="button"
              className="w-full bg-teal-600 text-white hover:bg-teal-500"
              onClick={onContinue}
              disabled={!canContinue || slotsLoading}
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
              onClick={onBack}
              disabled={form.isSubmitting}
            >
              {t.backStep}
            </Button>
            <Button
              type="button"
              className="w-full bg-teal-600 text-white hover:bg-teal-500"
              onClick={() => void form.handleCreateBooking()}
              disabled={
                form.isSubmitting ||
                !form.bookingSlotId ||
                !form.bookingScheduledAt
              }
            >
              {form.isSubmitting
                ? t.bookingCreating
                : t.doctorDetailConfirmBook}
            </Button>
          </>
        )}
      </DialogFooter>
    </div>
  );
}
