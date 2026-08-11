import { useCallback, useMemo } from "react";
import { Link, useRoute } from "wouter";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth";
import {
  buildDoctorWorkbenchSummaryModalCopy,
  DoctorWorkbenchAccessState,
  DoctorWorkbenchAppointmentsPanel,
  DoctorWorkbenchAppointmentSheet,
  DoctorWorkbenchOverview,
  DoctorWorkbenchSlotsPanel,
  useDoctorWorkbenchController,
} from "@/features/doctorWorkbench";
import { getVisitCopy, MedicalSummaryModal } from "@/features/visit";
import { getDisplayLocale, getLocalizedText } from "@/lib/i18n";

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
  const controller = useDoctorWorkbenchController({
    isCompatRoute,
    compatDoctorId,
    isAuthenticated,
    lang,
    tr,
  });
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

  if (controller.bindingMismatch) {
    return <DoctorWorkbenchAccessState kind="access_denied" tr={tr} />;
  }

  if (!controller.boundDoctorId) {
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
        controller.effectiveDoctorId ? (
          <Link href={`/doctor/${controller.effectiveDoctorId}`}>
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
            doctorName={controller.doctorName}
            doctor={controller.doctor}
            upcomingCount={controller.upcomingCount}
            slotsCount={controller.slots.length}
            appointments={controller.allAppointments}
            tr={tr}
          />

          <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
            <DoctorWorkbenchAppointmentsPanel
              items={controller.allAppointments}
              isLoading={controller.workbenchQuery.isLoading}
              errorMessage={controller.workbenchQuery.error?.message ?? null}
              locale={locale}
              lang={lang}
              tr={tr}
              isStarting={controller.isStarting}
              isOpeningRoom={controller.isOpeningRoom}
              onOpenDetail={controller.openDetailSheet}
              onStartConsultation={appointmentId => {
                void controller.startConsultation(appointmentId);
              }}
              onOpenRoom={appointmentId => {
                void controller.openDoctorRoom(appointmentId);
              }}
            />
            <DoctorWorkbenchSlotsPanel
              slots={controller.slots}
              isLoading={controller.slotsQuery.isLoading}
              errorMessage={controller.slotsQuery.error?.message ?? null}
              locale={locale}
              tr={tr}
            />
          </section>
        </div>
      </main>

      <DoctorWorkbenchAppointmentSheet
        open={controller.sheetOpen}
        onOpenChange={controller.setSheetOpen}
        detail={controller.detailQuery.data}
        isLoading={controller.detailQuery.isLoading}
        errorMessage={controller.detailQuery.error?.message ?? null}
        locale={locale}
        lang={lang}
        tr={tr}
        onStartConsultation={appointmentId => {
          void controller.startConsultation(appointmentId);
        }}
        onOpenRoom={appointmentId => {
          void controller.openDoctorRoom(appointmentId);
        }}
        onCompleteAndSummarize={appointmentId => {
          void controller.openSummaryModalFromWorkbench(appointmentId);
        }}
        isStarting={controller.isStarting}
        isOpeningRoom={controller.isOpeningRoom}
        isCompleting={controller.isCompleting}
      />

      {controller.summaryContext ? (
        <MedicalSummaryModal
          open={Boolean(controller.summaryContext)}
          onOpenChange={controller.handleSummaryOpenChange}
          visitId={controller.summaryContext.appointmentId}
          token={controller.summaryContext.token}
          lang={lang}
          copy={summaryModalCopy}
          onSigned={controller.handleSummarySigned}
        />
      ) : null}
    </AppLayout>
  );
}
