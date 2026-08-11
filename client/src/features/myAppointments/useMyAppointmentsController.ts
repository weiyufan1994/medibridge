import React from "react";
import { toast } from "sonner";
import { getAppointmentSurfaceText } from "@/features/appointment";
import { trpc } from "@/lib/trpc";
import {
  extractMyAppointmentTokenFromJoinUrl,
  getMyAppointmentSections,
  mapMyAppointmentActionErrorMessage,
  type DashboardAppointmentCopy,
  type MyAppointmentItem,
  type MyAppointmentTab,
} from "./myAppointmentsPresentation";

export function useMyAppointmentsController(options: {
  resolved: "en" | "zh";
  copy: DashboardAppointmentCopy;
}) {
  const { resolved, copy } = options;
  const [activeTab, setActiveTab] =
    React.useState<MyAppointmentTab>("upcoming");
  const [actingAppointmentId, setActingAppointmentId] = React.useState<
    number | null
  >(null);
  const [summaryModalOpen, setSummaryModalOpen] = React.useState(false);
  const [summaryAccess, setSummaryAccess] = React.useState<{
    appointmentId: number;
    token: string;
  } | null>(null);

  const query = trpc.appointments.listMyAppointments.useQuery();
  const resendMutation = trpc.appointments.resendLink.useMutation();
  const openRoomMutation = trpc.appointments.openMyRoom.useMutation();
  const retryPaymentMutation =
    trpc.payments.createCheckoutSessionForAppointment.useMutation();

  const summaryQueryInput = React.useMemo(
    () => ({
      appointmentId: summaryAccess?.appointmentId ?? 1,
      token: summaryAccess?.token ?? "summary-placeholder-token",
      lang: resolved,
    }),
    [resolved, summaryAccess]
  );
  const summaryDetailQuery = trpc.appointments.getByToken.useQuery(
    summaryQueryInput,
    {
      enabled: Boolean(summaryAccess && summaryModalOpen),
      retry: 1,
    }
  );
  const summaryDoctorQuery = trpc.doctors.getById.useQuery(
    { id: summaryDetailQuery.data?.doctorId ?? 0 },
    {
      enabled: Boolean(summaryModalOpen && summaryDetailQuery.data?.doctorId),
      retry: 1,
    }
  );

  const handleTabChange = (value: string) => {
    if (value === "upcoming" || value === "past_visits") {
      setActiveTab(value);
    }
  };

  const handleOpenAccess = async (item: MyAppointmentItem) => {
    setActingAppointmentId(item.id);
    try {
      if (item.status === "pending_payment" || item.status === "draft") {
        const checkout = await retryPaymentMutation.mutateAsync({
          appointmentId: item.id,
        });
        if (typeof window !== "undefined") {
          window.location.href = checkout.checkoutSessionUrl;
        }
        return;
      }

      if (
        item.status === "paid" ||
        item.status === "active" ||
        item.status === "ended" ||
        item.status === "completed"
      ) {
        const result = await openRoomMutation.mutateAsync({
          appointmentId: item.id,
        });
        if (typeof window !== "undefined") {
          window.location.href = result.joinUrl;
        }
        return;
      }

      const result = await resendMutation.mutateAsync({
        appointmentId: item.id,
      });
      if (result.devLink && typeof window !== "undefined") {
        const nextUrl = new URL(result.devLink);
        window.location.href = `${nextUrl.pathname}${nextUrl.search}`;
        return;
      }
      toast.success(copy.accessSentEmail);
    } catch (error) {
      toast.error(mapMyAppointmentActionErrorMessage(error, copy));
    } finally {
      setActingAppointmentId(null);
    }
  };

  const handleViewChatHistory = async (item: MyAppointmentItem) => {
    setActingAppointmentId(item.id);
    try {
      const result = await openRoomMutation.mutateAsync({
        appointmentId: item.id,
      });
      if (typeof window !== "undefined") {
        window.location.href = result.joinUrl;
      }
    } catch (error) {
      toast.error(mapMyAppointmentActionErrorMessage(error, copy));
    } finally {
      setActingAppointmentId(null);
    }
  };

  const handleViewMedicalSummary = async (item: MyAppointmentItem) => {
    setActingAppointmentId(item.id);
    try {
      const result = await openRoomMutation.mutateAsync({
        appointmentId: item.id,
      });
      const token = extractMyAppointmentTokenFromJoinUrl(result.joinUrl);
      if (!token) {
        throw new Error(copy.medicalSummaryLoadFailed);
      }
      setSummaryAccess({ appointmentId: item.id, token });
      setSummaryModalOpen(true);
    } catch (error) {
      toast.error(mapMyAppointmentActionErrorMessage(error, copy));
    } finally {
      setActingAppointmentId(null);
    }
  };

  const handleResend = async (appointmentId: number) => {
    setActingAppointmentId(appointmentId);
    try {
      await resendMutation.mutateAsync({ appointmentId });
      toast.success(copy.accessSent);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.resendFailed);
    } finally {
      setActingAppointmentId(null);
    }
  };

  const handleSummaryOpenChange = (nextOpen: boolean) => {
    setSummaryModalOpen(nextOpen);
    if (!nextOpen) {
      setSummaryAccess(null);
    }
  };

  const data = query.data ?? { upcoming: [], completed: [], past: [] };
  const { upcomingItems, pastVisitItems } = getMyAppointmentSections(data);
  const summaryDoctorId = summaryDetailQuery.data?.doctorId ?? null;
  const summaryDoctorFallback = copy.doctorFallback.replace(
    "{{id}}",
    summaryDoctorId ? String(summaryDoctorId) : "-"
  );
  const summaryDoctorName = getAppointmentSurfaceText({
    lang: resolved,
    value: summaryDoctorQuery.data?.doctor?.name,
    fallback: summaryDoctorFallback,
  });

  return {
    activeTab,
    actingAppointmentId,
    handleOpenAccess,
    handleResend,
    handleSummaryOpenChange,
    handleTabChange,
    handleViewChatHistory,
    handleViewMedicalSummary,
    pastVisitItems,
    query,
    summaryDetailQuery,
    summaryDoctorName,
    summaryModalOpen,
    upcomingItems,
  };
}
