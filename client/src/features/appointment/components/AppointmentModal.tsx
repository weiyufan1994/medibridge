import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatAppointmentDateInput,
  type AppointmentSlot,
} from "@/features/appointment/appointmentModalPresentation";
import { AppointmentDoctorSummary } from "@/features/appointment/components/AppointmentDoctorSummary";
import { AppointmentIntakeStep } from "@/features/appointment/components/AppointmentIntakeStep";
import { AppointmentModalFooter } from "@/features/appointment/components/AppointmentModalFooter";
import { AppointmentSelectionStep } from "@/features/appointment/components/AppointmentSelectionStep";
import { getAppointmentCopy } from "@/features/appointment/copy";
import { useAppointmentForm } from "@/features/appointment/hooks/useAppointmentForm";
import { buildSlotGroups } from "@/features/appointment/utils/slotDates";
import { trpc } from "@/lib/trpc";
import type { TriagePrefillInput } from "@shared/appointmentIntake";

type AppointmentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: number | null;
  sessionId: string;
  resolved: "en" | "zh";
  triagePrefill?: TriagePrefillInput;
};

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
  const form = useAppointmentForm({
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
      appointmentType: form.bookingType,
    },
    { enabled: open && !!doctorId }
  );

  useEffect(() => {
    if (!open) {
      setStep(1);
      setShowEditInfo(false);
      setSelectedDate("");
    }
  }, [open]);

  const slots = useMemo(() => {
    const rows = (slotQuery.data ?? []) as AppointmentSlot[];
    return rows.filter(slot => slot.appointmentType === form.bookingType);
  }, [form.bookingType, slotQuery.data]);
  const slotGroups = useMemo(() => buildSlotGroups(slots), [slots]);
  const availableDates = useMemo(
    () => Array.from(slotGroups.keys()).sort(),
    [slotGroups]
  );
  const activeDate =
    selectedDate || availableDates[0] || formatAppointmentDateInput(new Date());
  const activeSlots = slotGroups.get(activeDate) ?? [];

  useEffect(() => {
    if (open && !selectedDate && availableDates.length > 0) {
      setSelectedDate(availableDates[0]!);
    }
  }, [availableDates, open, selectedDate]);

  useEffect(() => {
    if (!form.bookingSlotId) return;

    const selectedStillVisible = slots.some(
      slot => slot.id === form.bookingSlotId
    );
    if (!selectedStillVisible) {
      form.setBookingSlotId(null);
      form.setBookingScheduledAt("");
    }
  }, [
    form.bookingSlotId,
    form.setBookingScheduledAt,
    form.setBookingSlotId,
    slots,
  ]);

  const selectedPackage = form.packageOptions.find(
    option => option.id === form.bookingPackageId
  );
  const selectedSlot =
    slots.find(slot => slot.id === form.bookingSlotId) ?? null;

  const handleSlotSelect = (slot: AppointmentSlot) => {
    form.setBookingSlotId(slot.id);
    form.setBookingScheduledAt(slot.startAt.toISOString());
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

            <AppointmentDoctorSummary
              doctorId={doctorId}
              doctor={doctorQuery.data?.doctor}
              resolved={resolved}
              t={t}
            />

            {step === 1 ? (
              <AppointmentSelectionStep
                activeDate={activeDate}
                activeSlots={activeSlots}
                form={form}
                onDateChange={setSelectedDate}
                onSlotSelect={handleSlotSelect}
                resolved={resolved}
                selectedSlot={selectedSlot}
                slotsLoading={slotQuery.isLoading}
                t={t}
              />
            ) : (
              <AppointmentIntakeStep
                form={form}
                onToggleEditInfo={() => setShowEditInfo(current => !current)}
                showEditInfo={showEditInfo}
                t={t}
              />
            )}
          </div>

          <AppointmentModalFooter
            canContinue={!!selectedSlot && !!selectedPackage}
            form={form}
            onBack={() => setStep(1)}
            onCancel={() => onOpenChange(false)}
            onContinue={handleContinue}
            slotsLoading={slotQuery.isLoading}
            step={step}
            t={t}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
