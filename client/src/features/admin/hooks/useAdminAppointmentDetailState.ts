import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { computeAdminRisks, computeAdminSuggestions } from "../risk";

export function toDateTimeLocalValue(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function useAdminAppointmentDetailState({
  canReadAdmin,
  isAppointmentsActive,
  lang,
}: {
  canReadAdmin: boolean;
  isAppointmentsActive: boolean;
  lang: "zh" | "en";
}) {
  const [appointmentIdInput, setAppointmentIdInput] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    number | null
  >(null);
  const [manualStatus, setManualStatus] = useState("active");
  const [manualPaymentStatus, setManualPaymentStatus] = useState("paid");
  const [manualStatusReason, setManualStatusReason] = useState("");
  const [manualScheduledAt, setManualScheduledAt] = useState("");
  const [issuedLinks, setIssuedLinks] = useState<{
    patientLink: string;
    doctorLink: string;
  } | null>(null);

  useEffect(() => {
    setManualStatusReason("");
  }, [selectedAppointmentId]);

  const appointmentDetailQuery = trpc.system.adminAppointmentDetail.useQuery(
    { appointmentId: selectedAppointmentId ?? 0 },
    {
      enabled:
        canReadAdmin &&
        isAppointmentsActive &&
        typeof selectedAppointmentId === "number",
    }
  );
  const visitSummaryQuery = trpc.system.adminGetVisitSummary.useQuery(
    { appointmentId: selectedAppointmentId ?? 0 },
    {
      enabled:
        canReadAdmin &&
        isAppointmentsActive &&
        typeof selectedAppointmentId === "number",
    }
  );

  useEffect(() => {
    const scheduledAt = appointmentDetailQuery.data?.appointment.scheduledAt;
    setManualScheduledAt(toDateTimeLocalValue(scheduledAt));
  }, [appointmentDetailQuery.data?.appointment.scheduledAt]);

  const risks = useMemo(
    () => computeAdminRisks(appointmentDetailQuery.data, new Date(), lang),
    [appointmentDetailQuery.data, lang]
  );
  const suggestions = useMemo(
    () => computeAdminSuggestions(appointmentDetailQuery.data, risks, lang),
    [appointmentDetailQuery.data, risks, lang]
  );

  return {
    appointmentIdInput,
    selectedAppointmentId,
    manualStatus,
    manualPaymentStatus,
    manualStatusReason,
    manualScheduledAt,
    issuedLinks,
    appointmentDetailQuery,
    visitSummaryQuery,
    risks,
    suggestions,
    setAppointmentIdInput,
    setSelectedAppointmentId,
    setManualStatus,
    setManualPaymentStatus,
    setManualStatusReason,
    setManualScheduledAt,
    setIssuedLinks,
  };
}
