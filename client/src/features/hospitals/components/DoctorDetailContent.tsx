import { Hospital, Stethoscope, Star, ThumbsUp, Globe, ExternalLink, User } from "lucide-react";
import {
  MISSING_TRANSLATION,
  MISSING_TRANSLATION_ZH,
  getLocalizedTextWithZhFallback,
} from "@/lib/i18n";
import type { LocalizedText } from "@shared/types";

type Lang = "zh" | "en";

type Doctor = {
  id: number;
  name: LocalizedText;
  title: LocalizedText;
  specialty: LocalizedText;
  expertise: LocalizedText;
  recommendationScore: string | number | null;
  onlineConsultation: LocalizedText;
  appointmentAvailable: LocalizedText;
  satisfactionRate: LocalizedText;
  attitudeScore: LocalizedText;
  haodafUrl: string | null;
};

type HospitalInfo = {
  name: LocalizedText;
  city: LocalizedText;
  level: LocalizedText;
  address: LocalizedText;
  website: string | null;
  imageUrl: string | null;
};

type Department = {
  name: LocalizedText;
};

type DoctorDetailData = {
  doctor: Doctor;
  hospital: HospitalInfo;
  department: Department;
};

type TranslationFn = (key: string, fallback?: string) => string;

type Props = {
  data: DoctorDetailData;
  resolved: Lang;
  t: TranslationFn;
  onBookAppointment: () => void;
};

const cleanupText = (value?: string | null): string => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed === "(页面未显示)") {
    return "";
  }
  if (trimmed === "翻译处理中" || trimmed === MISSING_TRANSLATION_ZH) {
    return "";
  }
  if (trimmed === "Translation in progress" || trimmed === MISSING_TRANSLATION) {
    return "";
  }
  return trimmed;
};

export function DoctorDetailContent({
  data,
  resolved,
  t,
  onBookAppointment,
}: Props) {
  const { doctor, hospital, department } = data;

  const doctorName = getLocalizedTextWithZhFallback({
    lang: resolved,
    value: doctor.name,
  });
  const doctorTitle = getLocalizedTextWithZhFallback({
    lang: resolved,
    value: doctor.title,
  });
  const doctorSpecialty = getLocalizedTextWithZhFallback({
    lang: resolved,
    value: doctor.specialty,
  });
  const doctorExpertise = getLocalizedTextWithZhFallback({
    lang: resolved,
    value: doctor.expertise,
  });

  const hospitalName = getLocalizedTextWithZhFallback({
    lang: resolved,
    value: hospital.name,
  });
  const departmentName = getLocalizedTextWithZhFallback({
    lang: resolved,
    value: department.name,
  });
  const hospitalCity = getLocalizedTextWithZhFallback({
    lang: resolved,
    value: hospital.city,
  });
  const hospitalLevel = getLocalizedTextWithZhFallback({
    lang: resolved,
    value: hospital.level,
  });
  const hospitalAddress = getLocalizedTextWithZhFallback({
    lang: resolved,
    value: hospital.address,
  });

  const satisfaction = getLocalizedTextWithZhFallback({
    lang: resolved,
    value: doctor.satisfactionRate,
  });
  const attitude = getLocalizedTextWithZhFallback({
    lang: resolved,
    value: doctor.attitudeScore,
  });

  const doctorDisplayName = cleanupText(doctorName);
  const doctorDisplayTitle = cleanupText(doctorTitle);
  const doctorSpecialtyClean = cleanupText(doctorSpecialty);
  const doctorExpertiseClean = cleanupText(doctorExpertise);
  const hospitalNameClean = cleanupText(hospitalName);
  const departmentNameClean = cleanupText(departmentName);
  const hospitalCityClean = cleanupText(hospitalCity);
  const hospitalLevelClean = cleanupText(hospitalLevel);
  const hospitalAddressClean = cleanupText(hospitalAddress);
  const satisfactionClean = cleanupText(satisfaction);
  const attitudeClean = cleanupText(attitude);
  const recommendationClean = cleanupText(
    doctor.recommendationScore === null || doctor.recommendationScore === undefined
      ? ""
      : String(doctor.recommendationScore)
  );

  const avatarInitial = doctorDisplayName ? doctorDisplayName.charAt(0).toUpperCase() : "";
  const expertiseItems = [doctorSpecialtyClean, doctorExpertiseClean].filter(Boolean);

  const isValidRating = (value: string): boolean => {
    const parsed = Number.parseFloat(value);
    if (Number.isNaN(parsed)) {
      return false;
    }
    return parsed > 0;
  };

  const ratings = [
    {
      key: "Satisfaction",
      label: t("doctor.satisfaction"),
      value: satisfactionClean,
      icon: <ThumbsUp className="w-4 h-4 text-slate-500" aria-hidden="true" />,
    },
    {
      key: "Attitude",
      label: t("doctor.attitude"),
      value: attitudeClean,
      icon: <Star className="w-4 h-4 text-slate-500" aria-hidden="true" />,
    },
    {
      key: "Recommendation",
      label: t("doctor.recommendation"),
      value: recommendationClean,
      icon: <ThumbsUp className="w-4 h-4 text-slate-500" aria-hidden="true" />,
    },
  ]
    .map(item => ({
      ...item,
      hasNumericValue: isValidRating(item.value),
    }))
    .filter(item => item.hasNumericValue);

  return (
    <div className="space-y-6">
      <section
        className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6"
        aria-label={t("doctor.hero_profile_aria")}
      >
        <div className="w-24 h-24 rounded-full bg-teal-50 flex items-center justify-center text-teal-700 flex-shrink-0 text-4xl font-bold">
          {avatarInitial ? <span aria-hidden="true">{avatarInitial}</span> : <User className="w-10 h-10" aria-hidden="true" />}
        </div>
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-slate-900 leading-tight">
            {doctorDisplayName || t("doctor.default_name")}
          </h1>
          {doctorDisplayTitle && <p className="mt-2 text-slate-600">{doctorDisplayTitle}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {hospitalNameClean && (
              <span className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm">
                <Hospital className="w-4 h-4" aria-hidden="true" />
                {hospitalNameClean}
              </span>
            )}
            {departmentNameClean && (
              <span className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm">
                {departmentNameClean}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-3 w-full sm:w-auto border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100">
          <button
            type="button"
            onClick={onBookAppointment}
            className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-medium px-8 py-2.5 rounded-xl transition-colors shadow-sm whitespace-nowrap"
          >
            {t("doctor.book_appointment")}
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl p-6 shadow-sm mb-6" aria-label={t("doctor.expertise")}>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <Stethoscope className="w-5 h-5 text-slate-700" aria-hidden="true" />
          {t("doctor.expertise")}
        </h2>
        <div className="space-y-2 text-slate-700">
          {expertiseItems.length > 0 ? (
            expertiseItems.map(item => <p key={item}>{item}</p>)
          ) : (
            <p className="text-sm text-slate-400 italic">{t("common.no_details", "暂无详细介绍")}</p>
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl p-6 shadow-sm mb-6" aria-label={t("doctor.ratings")}>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <Star className="w-5 h-5 text-slate-700" aria-hidden="true" />
          {t("doctor.ratings")}
        </h2>
        {ratings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ratings.map(item => (
              <article className="bg-slate-50 rounded-lg p-4" key={item.key}>
                <div className="flex items-center gap-2 mb-1">
                  {item.icon}
                  <p className="text-xs text-slate-500">{item.label}</p>
                </div>
                <p className="flex items-center gap-1 text-2xl font-bold text-slate-900">
                  <span>{item.value}</span>
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">{t("common.no_statistics")}</p>
        )}
      </section>

      <section
        className="bg-white rounded-2xl p-6 shadow-sm"
        aria-label={t("doctor.hospital_information")}
      >
        <div className="w-full h-40 rounded-xl bg-slate-100 overflow-hidden mb-3 flex items-center justify-center">
          {hospital.imageUrl?.trim() ? (
            <img
              src={hospital.imageUrl}
              alt={hospitalNameClean}
              className="h-full w-full object-cover"
            />
          ) : (
            <Hospital className="w-10 h-10 text-slate-400" aria-hidden="true" />
          )}
        </div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <Hospital className="w-5 h-5 text-slate-700" aria-hidden="true" />
          {t("doctor.hospital_information")}
        </h2>
        <div className="space-y-3">
          <p className="font-medium text-slate-800">{hospitalNameClean}</p>
          <div className="flex flex-wrap gap-2">
            {hospitalLevelClean && (
              <span className="inline-flex items-center bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm">
                {hospitalLevelClean}
              </span>
            )}
            {hospitalCityClean && (
              <span className="inline-flex items-center bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm">
                {hospitalCityClean}
              </span>
            )}
          </div>
          {hospitalAddressClean ? (
            <p className="text-sm text-slate-600">{hospitalAddressClean}</p>
          ) : (
            <p className="text-sm italic text-slate-500">{t("common.no_data_yet")}</p>
          )}
          <div className="pt-2 flex flex-wrap gap-3">
            {hospital.website && (
              <a
                href={hospital.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-teal-700 hover:text-teal-800 inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded"
              >
                {t("doctor.hospital_website")}
                <Globe className="w-4 h-4 ml-1" aria-hidden="true" />
                <ExternalLink className="w-3 h-3 ml-1" aria-hidden="true" />
              </a>
            )}
            {doctor.haodafUrl && (
              <a
                href={doctor.haodafUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-teal-700 hover:text-teal-800 inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded"
              >
                {t("doctor.view_on_haodf")}
                <ExternalLink className="w-3 h-3 ml-1" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
