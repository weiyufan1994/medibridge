import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAppointmentCopy } from "@/features/appointment/copy";
import { getAppointmentSurfaceText } from "@/features/appointment/presentation";
import type { LocalizedText } from "@shared/types";

type Props = {
  doctorId: number | null;
  doctor?: {
    imageUrl?: string | null;
    name?: LocalizedText | null;
    title?: LocalizedText | null;
  } | null;
  resolved: "en" | "zh";
  t: ReturnType<typeof getAppointmentCopy>;
};

export function AppointmentDoctorSummary({
  doctorId,
  doctor,
  resolved,
  t,
}: Props) {
  const fallback = t.doctorFallback.replace("{{id}}", String(doctorId ?? ""));
  const doctorName = doctor
    ? getAppointmentSurfaceText({
        lang: resolved,
        value: doctor.name,
        fallback,
      })
    : fallback;
  const doctorTitle = doctor
    ? getAppointmentSurfaceText({
        lang: resolved,
        value: doctor.title,
        fallback: t.bookingTypeOnline,
      })
    : t.bookingTypeOnline;

  return (
    <div className="mt-6 rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {t.doctorCardTitle}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Avatar className="h-12 w-12 ring-2 ring-white">
          <AvatarImage src={doctor?.imageUrl ?? undefined} />
          <AvatarFallback className="bg-teal-600 text-white">
            {(doctorName ?? fallback).slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{doctorName}</p>
          <p className="truncate text-sm text-slate-500">{doctorTitle}</p>
        </div>
      </div>
    </div>
  );
}
