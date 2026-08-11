import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  getDoctorWorkbenchHeading,
  normalizeDoctorWorkbenchError,
  parseDoctorWorkbenchToken,
  shouldCompleteDoctorWorkbenchBeforeSummary,
  shouldStartDoctorWorkbenchBeforeOpeningRoom,
} from "./presentation";
import type {
  DoctorWorkbenchItem,
  DoctorWorkbenchLanguage,
  DoctorWorkbenchTranslate,
} from "./types";

export function useDoctorWorkbenchController(options: {
  isCompatRoute: boolean;
  compatDoctorId: number | null;
  isAuthenticated: boolean;
  lang: DoctorWorkbenchLanguage;
  tr: DoctorWorkbenchTranslate;
}) {
  const { isCompatRoute, compatDoctorId, isAuthenticated, lang, tr } = options;
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    number | null
  >(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [summaryContext, setSummaryContext] = useState<{
    appointmentId: number;
    token: string;
  } | null>(null);

  const myBindingQuery = trpc.doctorAccounts.getMyBinding.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const boundDoctorId = myBindingQuery.data?.activeBinding?.doctorId ?? null;
  const effectiveDoctorId =
    isCompatRoute && compatDoctorId ? compatDoctorId : boundDoctorId;
  const bindingMismatch = Boolean(
    isCompatRoute &&
      compatDoctorId &&
      boundDoctorId &&
      compatDoctorId !== boundDoctorId
  );

  const doctorQuery = trpc.doctors.getById.useQuery(
    { id: effectiveDoctorId ?? 0 },
    { enabled: typeof effectiveDoctorId === "number" && effectiveDoctorId > 0 }
  );
  const workbenchQuery = trpc.appointments.listDoctorWorkbench.useQuery(
    {
      doctorId: isCompatRoute && compatDoctorId ? compatDoctorId : undefined,
      limit: 30,
    },
    {
      enabled:
        isAuthenticated &&
        !bindingMismatch &&
        typeof effectiveDoctorId === "number" &&
        effectiveDoctorId > 0,
    }
  );
  const slotsQuery = trpc.scheduling.listDoctorUpcomingSlots.useQuery(
    { doctorId: isCompatRoute && compatDoctorId ? compatDoctorId : undefined },
    {
      enabled:
        isAuthenticated &&
        !bindingMismatch &&
        typeof effectiveDoctorId === "number" &&
        effectiveDoctorId > 0,
    }
  );
  const detailQuery =
    trpc.appointments.getDoctorWorkbenchAppointmentDetail.useQuery(
      {
        appointmentId: selectedAppointmentId ?? 0,
        doctorId: isCompatRoute && compatDoctorId ? compatDoctorId : undefined,
        lang,
      },
      {
        enabled:
          isAuthenticated &&
          !bindingMismatch &&
          typeof selectedAppointmentId === "number" &&
          selectedAppointmentId > 0,
      }
    );

  const issueLinksMutation = trpc.appointments.issueAccessLinks.useMutation();
  const startAppointmentMutation =
    trpc.appointments.startDoctorWorkbenchAppointment.useMutation({
      onSuccess: async () => {
        await Promise.all([workbenchQuery.refetch(), detailQuery.refetch()]);
        toast.success(tr("已开始接诊。", "Consultation started."));
      },
      onError: error => {
        toast.error(
          error.message || tr("开始接诊失败。", "Failed to start consultation.")
        );
      },
    });
  const completeAppointmentMutation =
    trpc.appointments.completeAppointment.useMutation();

  const doctorName = useMemo(() => {
    const doctor = doctorQuery.data?.doctor;
    return getDoctorWorkbenchHeading({
      lang,
      doctorName: doctor?.name,
      tr,
    });
  }, [doctorQuery.data?.doctor, lang, tr]);

  const allAppointments = useMemo(
    () =>
      [
        ...(workbenchQuery.data?.upcoming ?? []),
        ...(workbenchQuery.data?.recent ?? []),
      ] as DoctorWorkbenchItem[],
    [workbenchQuery.data?.recent, workbenchQuery.data?.upcoming]
  );

  const openDetailSheet = useCallback((appointmentId: number) => {
    setSelectedAppointmentId(appointmentId);
    setSheetOpen(true);
  }, []);

  const refreshWorkbenchData = useCallback(async () => {
    await Promise.all([
      workbenchQuery.refetch(),
      slotsQuery.refetch(),
      detailQuery.refetch(),
      myBindingQuery.refetch(),
    ]);
  }, [detailQuery, myBindingQuery, slotsQuery, workbenchQuery]);

  const ensureDoctorAccessToken = useCallback(
    async (appointmentId: number) => {
      const issued = await issueLinksMutation.mutateAsync({ appointmentId });
      const token = parseDoctorWorkbenchToken(issued.doctorLink);
      if (!token) {
        throw new Error(
          tr("无法解析医生房间 token。", "Failed to parse doctor room token.")
        );
      }
      return {
        token,
        doctorLink: issued.doctorLink,
      };
    },
    [issueLinksMutation, tr]
  );

  const startConsultation = useCallback(
    async (appointmentId: number) => {
      try {
        await startAppointmentMutation.mutateAsync({
          appointmentId,
          doctorId:
            isCompatRoute && compatDoctorId ? compatDoctorId : undefined,
        });
      } catch {
        // Mutation handles toast messaging.
      }
    },
    [compatDoctorId, isCompatRoute, startAppointmentMutation]
  );

  const openDoctorRoom = useCallback(
    async (appointmentId: number) => {
      try {
        const item = allAppointments.find(entry => entry.id === appointmentId);
        if (shouldStartDoctorWorkbenchBeforeOpeningRoom(item?.status)) {
          await startConsultation(appointmentId);
        }
        const issued = await ensureDoctorAccessToken(appointmentId);
        window.location.href = issued.doctorLink;
      } catch (error) {
        toast.error(
          normalizeDoctorWorkbenchError(
            error,
            tr("无法打开医生房间。", "Unable to open doctor room.")
          )
        );
      }
    },
    [allAppointments, ensureDoctorAccessToken, startConsultation, tr]
  );

  const openSummaryModalFromWorkbench = useCallback(
    async (appointmentId: number) => {
      try {
        const item = allAppointments.find(entry => entry.id === appointmentId);
        const access = await ensureDoctorAccessToken(appointmentId);

        if (shouldCompleteDoctorWorkbenchBeforeSummary(item?.status)) {
          try {
            await completeAppointmentMutation.mutateAsync({
              appointmentId,
              token: access.token,
            });
          } catch (error) {
            const message = normalizeDoctorWorkbenchError(
              error,
              tr("结束问诊失败。", "Failed to end consultation.")
            );
            if (message !== "APPOINTMENT_INVALID_STATUS_TRANSITION") {
              throw error;
            }
          }
        }

        setSummaryContext({
          appointmentId,
          token: access.token,
        });
        await refreshWorkbenchData();
      } catch (error) {
        toast.error(
          normalizeDoctorWorkbenchError(
            error,
            tr(
              "无法打开病历摘要流程。",
              "Unable to open medical summary workflow."
            )
          )
        );
      }
    },
    [
      allAppointments,
      completeAppointmentMutation,
      ensureDoctorAccessToken,
      refreshWorkbenchData,
      tr,
    ]
  );

  const handleSummaryOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSummaryContext(null);
    }
  }, []);

  const handleSummarySigned = useCallback(() => {
    void refreshWorkbenchData();
    void detailQuery.refetch();
  }, [detailQuery, refreshWorkbenchData]);

  return {
    boundDoctorId,
    effectiveDoctorId,
    bindingMismatch,
    doctor: doctorQuery.data?.doctor ?? null,
    doctorName,
    allAppointments,
    upcomingCount: workbenchQuery.data?.upcoming.length ?? 0,
    slots: slotsQuery.data ?? [],
    workbenchQuery,
    slotsQuery,
    detailQuery,
    sheetOpen,
    setSheetOpen,
    summaryContext,
    openDetailSheet,
    startConsultation,
    openDoctorRoom,
    openSummaryModalFromWorkbench,
    handleSummaryOpenChange,
    handleSummarySigned,
    isStarting: startAppointmentMutation.isPending,
    isOpeningRoom: issueLinksMutation.isPending,
    isCompleting:
      completeAppointmentMutation.isPending || issueLinksMutation.isPending,
  };
}
