import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { AppointmentModal } from "@/features/appointment/components/AppointmentModal";
import { useLanguage } from "@/contexts/LanguageContext";
import { DoctorDetailContent } from "@/features/hospitals/components/DoctorDetailContent";
import { useDoctorDetail } from "@/features/hospitals/hooks/useDoctorDetail";
import { getHospitalsCopy } from "@/features/hospitals/copy";

type TranslationFn = (key: string, fallback?: string) => string;

function useTranslation(): TranslationFn {
  const { resolved } = useLanguage();
  const copy = getHospitalsCopy(resolved);
  const doctorDetail = copy.doctorDetail;

  return (key: string, fallback = "") => {
    const dictionary: Record<string, string> = {
      "doctor.page_title": doctorDetail.pageTitle,
      "doctor.book_appointment": doctorDetail.bookAppointment,
      "doctor.consultation_service": doctorDetail.consultationService,
      "doctor.expertise": doctorDetail.expertise,
      "doctor.ratings": doctorDetail.ratings,
      "doctor.hospital_information": doctorDetail.hospitalInformation,
      "doctor.secure_payment_guarantee": doctorDetail.securePaymentGuarantee,
      "doctor.satisfaction": doctorDetail.satisfactionLabel,
      "doctor.attitude": doctorDetail.attitudeLabel,
      "doctor.recommendation": doctorDetail.recommendationLabel,
      "doctor.hospital_website": doctorDetail.hospitalWebsite,
      "doctor.view_on_haodf": doctorDetail.viewOnHaodf,
      "doctor.default_name": doctorDetail.defaultDoctorName,
      "doctor.back_navigation": doctorDetail.backNavigation,
      "doctor.booking_panel_aria": doctorDetail.bookingPanelAria,
      "common.no_details": doctorDetail.noDataYet,
      "common.no_data_yet": doctorDetail.noDataYet,
      "common.no_statistics": doctorDetail.noStatistics,
      "doctor.hero_profile_aria": doctorDetail.heroProfileAria,
    };

    return dictionary[key] || fallback || key;
  };
}

export default function DoctorDetail() {
  const [, params] = useRoute("/doctor/:id");
  const [, setLocation] = useLocation();
  const doctorId = params?.id ? parseInt(params.id) : 0;
  const { resolved } = useLanguage();
  const copy = getHospitalsCopy(resolved);
  const t = useTranslation();
  const [bookingOpen, setBookingOpen] = useState(false);

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    setLocation("/hospitals");
  };

  const { data, isLoading, error } = useDoctorDetail(doctorId);

  if (isLoading) {
    return (
      <AppLayout title={t("doctor.page_title")}>
        <main className="bg-slate-50 min-h-screen w-full flex-1">
          <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        </main>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout title={t("doctor.page_title")}>
        <main className="bg-slate-50 min-h-screen w-full flex-1">
          <div className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6">
            <nav
              aria-label={t("doctor.back_navigation")}
              className="mb-3"
            >
              <button
                type="button"
                onClick={handleGoBack}
                className="inline-flex items-center text-slate-500 hover:text-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded"
              >
                <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                {t("doctor.back_navigation")}
              </button>
            </nav>

            <section className="bg-white rounded-2xl p-10 shadow-sm border border-slate-100 text-center">
              <p className="text-slate-500">{copy.doctorDetail.notFound}</p>
              <Link href="/">
                <Button variant="link" className="mt-4">
                  {copy.doctorDetail.backToHome}
                </Button>
              </Link>
            </section>
          </div>
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={t("doctor.page_title")}>
      <main className="bg-slate-50 min-h-screen w-full flex-1">
        <div className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6">
          <nav
            aria-label={t("doctor.back_navigation")}
          >
            <button
              type="button"
              onClick={handleGoBack}
              className="inline-flex items-center text-slate-500 hover:text-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded"
            >
              <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
              {t("doctor.back_navigation")}
            </button>
          </nav>

          <section className="flex flex-col gap-4 mt-4">
            <div className="flex justify-end">
              <Link href="/doctor/workbench">
                <Button variant="outline">
                  {resolved === "zh" ? "医生工作台" : "Doctor Workbench"}
                </Button>
              </Link>
            </div>
            <DoctorDetailContent
              data={data}
              resolved={resolved}
              t={t}
              onBookAppointment={() => setBookingOpen(true)}
            />
          </section>
        </div>
      </main>

      <AppointmentModal
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        doctorId={data.doctor.id}
        sessionId=""
        resolved={resolved}
      />
    </AppLayout>
  );
}
