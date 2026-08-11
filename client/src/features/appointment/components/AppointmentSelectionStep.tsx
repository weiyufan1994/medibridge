import { Calendar, Clock3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getAppointmentCopy } from "@/features/appointment/copy";
import {
  type AppointmentPackageId,
  type AppointmentType,
  type UseAppointmentFormResult,
} from "@/features/appointment/hooks/useAppointmentForm";
import {
  formatAppointmentDateInput,
  formatAppointmentSlotRange,
  type AppointmentSlot,
} from "@/features/appointment/appointmentModalPresentation";
import { getLocalizedText } from "@/lib/i18n";

type Props = {
  activeDate: string;
  activeSlots: AppointmentSlot[];
  form: UseAppointmentFormResult;
  onDateChange: (date: string) => void;
  onSlotSelect: (slot: AppointmentSlot) => void;
  resolved: "en" | "zh";
  selectedSlot: AppointmentSlot | null;
  slotsLoading: boolean;
  t: ReturnType<typeof getAppointmentCopy>;
};

export function AppointmentSelectionStep({
  activeDate,
  activeSlots,
  form,
  onDateChange,
  onSlotSelect,
  resolved,
  selectedSlot,
  slotsLoading,
  t,
}: Props) {
  const selectBookingType = (value: AppointmentType) => {
    form.setBookingType(value);
    form.setBookingSlotId(null);
    form.setBookingScheduledAt("");
  };

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Calendar className="h-4 w-4 text-teal-600" />
          {t.selectDate}
        </div>
        <Input
          type="date"
          value={activeDate}
          onChange={event => onDateChange(event.target.value)}
          min={formatAppointmentDateInput(new Date())}
          disabled={form.isSubmitting || slotsLoading}
          className="mt-3 border-slate-200"
        />
        <p className="mt-2 text-xs text-slate-500">
          {selectedSlot
            ? `${t.bookingTime}: ${formatAppointmentSlotRange(selectedSlot, resolved)}`
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
              onClick={() => onSlotSelect(slot)}
              disabled={form.isSubmitting}
              className={`rounded-2xl border px-3 py-2 text-left text-sm transition ${
                form.bookingSlotId === slot.id
                  ? "border-teal-600 bg-teal-50 text-teal-800"
                  : "border-slate-200 bg-white text-slate-700 hover:border-teal-300"
              }`}
            >
              <div className="font-medium">
                {formatAppointmentSlotRange(slot, resolved)}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {slot.slotDurationMinutes} min
              </div>
            </button>
          ))}
        </div>
        {!slotsLoading && activeSlots.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{t.noSellableSlots}</p>
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
              onClick={() => selectBookingType(value)}
              className={`rounded-2xl border px-3 py-2 text-sm ${
                form.bookingType === value
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
          {form.packageOptions.map(option => (
            <button
              key={option.id}
              type="button"
              onClick={() =>
                form.setBookingPackageId(option.id as AppointmentPackageId)
              }
              disabled={form.isSubmitting || form.packagesLoading}
              className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                form.bookingPackageId === option.id
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
                  <p className="text-xs text-slate-500">
                    {option.durationMinutes} min
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
