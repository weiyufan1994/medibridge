import { useCallback, useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth";
import {
  buildDoctorWorkbenchSummaryModalCopy,
  DoctorWorkbenchAccessState,
  DoctorWorkbenchAppointmentsPanel,
  DoctorWorkbenchAppointmentSheet,
  DoctorWorkbenchOverview,
  DoctorWorkbenchSlotsPanel,
  getDoctorWorkbenchHeading,
  normalizeDoctorWorkbenchError,
  parseDoctorWorkbenchToken,
  type DoctorWorkbenchItem,
} from "@/features/doctorWorkbench";
import { getVisitCopy, MedicalSummaryModal } from "@/features/visit";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDisplayLocale, getLocalizedText } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function DoctorWorkbenchPage() {
  const [isCompatRoute, compatParams] = useRoute("/doctor/:id/workbench");
  const [isPrimaryRoute] = useRoute("/doctor/workbench");
  const compatDoctorId = compatParams?.id ? Number(compatParams.id) : null;
  const { resolved } = useLanguage();
  const lang = resolved as "zh" | "en";
  const locale = getDisplayLocale(lang);
  const visitCopy = getVisitCopy(lang);
  const { loading, isAuthenticated, openLoginModal, user } = useAuth();
  const tr = useCallback(
    (zh: string, en: string) =>
      getLocalizedText({ lang, value: { zh, en }, placeholder: zh }),
    [lang]
  );

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    number | null
  >(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [summaryContext, setSummaryContext] = useState<{
    appointmentId: number;
    token: string;
  } | null>(null);

  const utils = trpc.useUtils();
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

  const openDetailSheet = (appointmentId: number) => {
    setSelectedAppointmentId(appointmentId);
    setSheetOpen(true);
  };

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
        if (item?.status === "paid") {
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

        if (item && (item.status === "paid" || item.status === "active")) {
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

  const summaryModalCopy = useMemo(
    () => buildDoctorWorkbenchSummaryModalCopy(visitCopy),
    [visitCopy]
  );

  if (loading) {
    return <DoctorWorkbenchAccessState kind="loading" tr={tr} />;
  }

  if (!isAuthenticated) {
    return (
      <DoctorWorkbenchAccessState
        kind="login_required"
        tr={tr}
        onLogin={openLoginModal}
      />
    );
  }

  if (bindingMismatch) {
    return <DoctorWorkbenchAccessState kind="access_denied" tr={tr} />;
  }

  if (!boundDoctorId) {
    return (
      <DoctorWorkbenchAccessState
        kind="not_enabled"
        tr={tr}
        userEmail={user?.email}
      />
    );
  }

  return (
    <AppLayout
      title={tr("医生工作台", "Doctor Workbench")}
      rightElements={
        effectiveDoctorId ? (
          <Link href={`/doctor/${effectiveDoctorId}`}>
            <Button variant="outline">
              {tr("返回医生主页", "Back to Doctor Page")}
            </Button>
          </Link>
        ) : undefined
      }
    >
      <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.08),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#f8fafc_48%,#ffffff_100%)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
          <DoctorWorkbenchOverview
            showLegacyRouteNotice={!isPrimaryRoute}
            doctorName={doctorName}
            doctor={doctorQuery.data?.doctor ?? null}
            upcomingCount={workbenchQuery.data?.upcoming.length ?? 0}
            slotsCount={slotsQuery.data?.length ?? 0}
            appointments={allAppointments}
            tr={tr}
          />

          <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
            <DoctorWorkbenchAppointmentsPanel
              items={allAppointments}
              isLoading={workbenchQuery.isLoading}
              errorMessage={workbenchQuery.error?.message ?? null}
              locale={locale}
              lang={lang}
              tr={tr}
              isStarting={startAppointmentMutation.isPending}
              isOpeningRoom={issueLinksMutation.isPending}
              onOpenDetail={openDetailSheet}
              onStartConsultation={appointmentId => {
                void startConsultation(appointmentId);
              }}
              onOpenRoom={appointmentId => {
                void openDoctorRoom(appointmentId);
              }}
            />
            <DoctorWorkbenchSlotsPanel
              slots={slotsQuery.data ?? []}
              isLoading={slotsQuery.isLoading}
              errorMessage={slotsQuery.error?.message ?? null}
              locale={locale}
              tr={tr}
            />
          </section>
        </div>
      </main>

      <DoctorWorkbenchAppointmentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        detail={detailQuery.data}
        isLoading={detailQuery.isLoading}
        errorMessage={detailQuery.error?.message ?? null}
        locale={locale}
        tr={tr}
        onStartConsultation={appointmentId => {
          void startConsultation(appointmentId);
        }}
        onOpenRoom={appointmentId => {
          void openDoctorRoom(appointmentId);
        }}
        onCompleteAndSummarize={appointmentId => {
          void openSummaryModalFromWorkbench(appointmentId);
        }}
        isStarting={startAppointmentMutation.isPending}
        isOpeningRoom={issueLinksMutation.isPending}
        isCompleting={
          completeAppointmentMutation.isPending || issueLinksMutation.isPending
        }
      />

      {summaryContext ? (
        <MedicalSummaryModal
          open={Boolean(summaryContext)}
          onOpenChange={open => {
            if (!open) {
              setSummaryContext(null);
            }
          }}
          visitId={summaryContext.appointmentId}
          token={summaryContext.token}
          lang={lang}
          copy={summaryModalCopy}
          onSigned={() => {
            void refreshWorkbenchData();
            void detailQuery.refetch();
          }}
        />
      ) : null}
    </AppLayout>
  );
}
