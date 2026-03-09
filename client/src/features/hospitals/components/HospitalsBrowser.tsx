import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  ChevronRight,
  Hospital,
  Loader2,
  Search,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLocalizedField } from "@/lib/i18n";
import { getHospitalsCopy } from "@/features/hospitals/copy";

export type ViewMode = "hospitals" | "departments" | "doctors";

type Lang = "zh" | "en";

type HospitalItem = {
  id: number;
  name: string;
  nameEn: string | null;
  city: string | null;
  cityEn: string | null;
  level: string | null;
  levelEn: string | null;
  imageUrl: string | null;
};

type DepartmentItem = {
  id: number;
  name: string;
  nameEn: string | null;
};

type DoctorItem = {
  id: number;
  name: string;
  nameEn: string | null;
  title: string | null;
  titleEn: string | null;
  specialty: string | null;
  specialtyEn: string | null;
  expertise: string | null;
  expertiseEn: string | null;
  recommendationScore: string | number | null;
};

type DoctorWithDepartment = {
  doctor: DoctorItem;
};

type Props = {
  viewMode: ViewMode;
  selectedHospitalName: string;
  selectedHospitalLevel: string;
  selectedDepartmentName: string;
  selectedHospitalImageUrl?: string | null;
  hospitals?: HospitalItem[];
  hospitalsLoading: boolean;
  departments?: DepartmentItem[];
  departmentsLoading: boolean;
  filteredDoctors?: DoctorWithDepartment[];
  doctorsLoading: boolean;
  searchQuery: string;
  resolved: Lang;
  onSearchQueryChange: (value: string) => void;
  onSelectHospital: (hospitalId: number) => void;
  onSelectDepartment: (departmentId: number) => void;
  onBackToHospitals: () => void;
  onBackToDepartments: () => void;
};

export function HospitalsBrowser({
  viewMode,
  selectedHospitalName,
  selectedHospitalLevel,
  selectedDepartmentName,
  selectedHospitalImageUrl,
  hospitals,
  hospitalsLoading,
  departments,
  departmentsLoading,
  filteredDoctors,
  doctorsLoading,
  searchQuery,
  resolved,
  onSearchQueryChange,
  onSelectHospital,
  onSelectDepartment,
  onBackToHospitals,
  onBackToDepartments,
}: Props) {
  const copy = getHospitalsCopy(resolved);
  const [cityFilter, setCityFilter] = useState<"all" | string>("上海");

  const normalizedSearchQuery = useMemo(
    () => searchQuery.trim().toLowerCase(),
    [searchQuery]
  );

  const filteredHospitals = useMemo(() => {
    if (!hospitals) {
      return [];
    }

    return hospitals.filter((hospital) => {
      const hospitalName = getLocalizedField({
        lang: resolved,
        zh: hospital.name,
        en: hospital.nameEn,
      });
      const hospitalCity = getLocalizedField({
        lang: resolved,
        zh: hospital.city,
        en: hospital.cityEn,
      });
      const hospitalLevel = getLocalizedField({
        lang: resolved,
        zh: hospital.level,
        en: hospital.levelEn,
      });

      const cityMatch =
        cityFilter === "all" ||
        !cityFilter ||
        cityFilter === hospitalCity ||
        (hospitalCity && hospitalCity.toLowerCase() === "上海".toLowerCase()) ||
        (hospitalCity && hospitalCity.toLowerCase() === "shanghai");

      if (!cityMatch) {
        return false;
      }

      if (!normalizedSearchQuery) {
        return true;
      }

      return (
        hospitalName.toLowerCase().includes(normalizedSearchQuery) ||
        hospitalCity.toLowerCase().includes(normalizedSearchQuery) ||
        hospitalLevel.toLowerCase().includes(normalizedSearchQuery)
      );
    });
  }, [hospitals, cityFilter, normalizedSearchQuery, resolved]);
  const isDoctorsView = viewMode === "doctors";

  return (
    <div className={isDoctorsView ? "min-h-screen bg-slate-50 w-full" : "w-full"}>
      <nav
        aria-label={resolved === "en" ? "Hospital navigation" : "医院列表导航"}
        className="flex items-center gap-2 mb-6 text-sm text-slate-500"
      >
        <button
          onClick={onBackToHospitals}
          type="button"
          className={`hover:text-slate-900 transition-colors ${viewMode === "hospitals" ? "text-slate-900 font-semibold" : ""}`}
        >
          {copy.browser.breadcrumbHospitals}
        </button>
        {viewMode !== "hospitals" && (
          <>
            <ChevronRight className="w-4 h-4" />
            <button
              onClick={onBackToDepartments}
              type="button"
              className={`hover:text-slate-900 transition-colors ${
                viewMode === "departments" ? "text-slate-900 font-semibold" : ""
              }`}
            >
              {selectedHospitalName || copy.browser.breadcrumbDepartmentsFallback}
            </button>
            {viewMode === "doctors" && (
              <>
                <ChevronRight className="w-4 h-4" />
                <span className="text-foreground font-medium">
                  {selectedDepartmentName || copy.browser.breadcrumbDoctorsFallback}
                </span>
              </>
            )}
          </>
        )}
      </nav>

      {viewMode === "hospitals" && (
        <section>
          <header className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900">
              {copy.browser.selectHospitalTitle}
            </h1>
            <p className="text-slate-500 mt-2">
              {copy.browser.selectHospitalIntro}
            </p>
          </header>
          <div className="mb-8 flex flex-col sm:flex-row gap-4">
            <label htmlFor="hospital-search" className="sr-only">
              {copy.browser.searchHospitalsLabel}
            </label>
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                id="hospital-search"
                placeholder={copy.browser.searchHospitalsPlaceholder}
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                className="pl-9 h-11 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus-visible:ring-1 focus-visible:ring-teal-500 focus-visible:ring-offset-0"
              />
            </div>
            <label htmlFor="city-filter" className="sr-only">
              {copy.browser.cityLabel}
            </label>
            <select
              id="city-filter"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="h-11 rounded-md border border-slate-200 bg-white px-3 text-slate-700 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 min-w-44"
            >
              <option value="all">{copy.browser.allCities}</option>
              <option value="上海">{resolved === "en" ? "Shanghai" : "上海"}</option>
            </select>
          </div>

          {hospitalsLoading && (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
            </div>
          )}
          {!hospitalsLoading && filteredHospitals.length === 0 && (
            <p className="py-12 text-center text-slate-500">
              {copy.browser.noHospitalsFound}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-stretch">
            {filteredHospitals.map((hospital) => {
              const hospitalName = getLocalizedField({
                lang: resolved,
                zh: hospital.name,
                en: hospital.nameEn,
              });
              const hospitalCity = getLocalizedField({
                lang: resolved,
                zh: hospital.city,
                en: hospital.cityEn,
              });
              const hospitalLevel = getLocalizedField({
                lang: resolved,
                zh: hospital.level,
                en: hospital.levelEn,
              });
              const hospitalImage = hospital.imageUrl?.trim();
              const description = copy.browser.hospitalCardDescription;

              return (
                <article
                  key={hospital.id}
                  className="h-full bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow border border-slate-100 flex gap-5 items-start"
                  aria-label={hospitalName}
                >
                  <div className="w-24 h-24 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-500 text-xs">
                    {hospitalImage ? (
                      <img
                        src={hospitalImage}
                        alt={hospitalName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Hospital className="w-8 h-8 text-slate-400" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-900 line-clamp-2">
                      {hospitalName}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {hospital.level && <Badge variant="outline">{hospitalLevel}</Badge>}
                      {hospital.city && <Badge variant="secondary">{hospitalCity}</Badge>}
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 mt-2">{description}</p>
                    <div className="mt-auto pt-4">
                      <Button
                        type="button"
                        onClick={() => onSelectHospital(hospital.id)}
                        className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                      >
                        {copy.browser.viewDoctors}
                        <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {viewMode === "departments" && (
        <section>
          <img
            src={
              selectedHospitalImageUrl?.trim() ||
              "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=2000"
            }
            alt={selectedHospitalName}
            className="w-full h-64 md:h-72 object-cover rounded-2xl shadow-sm mb-8"
          />
          <div className="pb-8 border-b border-slate-100">
            <div className="flex items-center gap-4 mb-2">
              <h2 className="text-3xl font-bold text-slate-900">
                {selectedHospitalName}
              </h2>
              {selectedHospitalLevel ? (
                <Badge variant="outline" className="border-slate-300 text-slate-600">
                  {selectedHospitalLevel}
                </Badge>
              ) : null}
            </div>
            <p className="text-slate-600 leading-relaxed mt-4 max-w-4xl">
              {copy.browser.hospitalProfileDescription}
            </p>
            <p className="text-slate-500 leading-relaxed mt-3 max-w-4xl">
              {copy.browser.departmentHeroSubtitle}
            </p>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-6 mt-8">
            {copy.browser.selectDepartmentTitle}
          </h3>

          {departmentsLoading && (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          )}

          {!departmentsLoading && !departments?.length && (
            <p className="py-12 text-center text-slate-500">
              {copy.browser.noDepartmentsFound}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
            {departments?.map((dept) => {
              const departmentName = getLocalizedField({
                lang: resolved,
                zh: dept.name,
                en: dept.nameEn,
              });
              return (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => onSelectDepartment(dept.id)}
                  aria-label={`${departmentName} ${copy.browser.enterDepartment}`}
                  className="h-full min-h-[88px] w-full text-left bg-white rounded-xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex items-start gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50"
                >
                  <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 flex-shrink-0 transition-colors group-hover:bg-teal-600 group-hover:text-white">
                    <Stethoscope className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800 group-hover:text-teal-700 transition-colors line-clamp-2 leading-tight">
                      {departmentName}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {copy.browser.departmentCardSubtitle}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-teal-500 flex-shrink-0 self-start transition-colors" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {viewMode === "doctors" && (
        <section className="max-w-5xl mx-auto py-8 px-4">
          <h2 className="text-3xl font-bold text-slate-900">
            {selectedDepartmentName || copy.browser.doctorsTitle}
          </h2>
          <p className="text-slate-500 mt-1 mb-5">
            {copy.browser.doctorsCountLabel(filteredDoctors?.length || 0)}
          </p>
          <div className="relative mb-6">
            <label htmlFor="doctor-search" className="sr-only">
              {copy.browser.searchDoctorsLabel}
            </label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              id="doctor-search"
              placeholder={copy.browser.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="pl-10 pr-4 py-3 rounded-xl shadow-sm border-slate-200 focus:border-teal-500 focus-visible:ring-1 focus-visible:ring-teal-500 focus-visible:ring-offset-0"
            />
          </div>
          <div className="space-y-4">
            {doctorsLoading && (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
              </div>
            )}
            {filteredDoctors && filteredDoctors.length === 0 && (
              <div className="py-12 text-center text-slate-500">
                <p className="text-sm">{copy.browser.noDoctorsFound}</p>
              </div>
            )}
            {filteredDoctors?.map(({ doctor }) => {
              const doctorName = getLocalizedField({
                lang: resolved,
                zh: doctor.name,
                en: doctor.nameEn,
              });
              const doctorTitle = getLocalizedField({
                lang: resolved,
                zh: doctor.title,
                en: doctor.titleEn,
              });
              const doctorExpertise = getLocalizedField({
                lang: resolved,
                zh: doctor.expertise,
                en: doctor.expertiseEn,
              });
              return (
                <article
                  key={doctor.id}
                  className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 mb-4 flex flex-col sm:flex-row gap-6 items-start sm:items-center"
                >
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-teal-50 flex-shrink-0 flex items-center justify-center text-teal-600 border border-slate-200 overflow-hidden">
                    <Stethoscope className="w-8 h-8" aria-hidden="true" />
                  </div>
                  <div className="flex-1 flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h4 className="text-xl font-bold text-slate-900">{doctorName}</h4>
                      {doctor.recommendationScore && (
                        <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded text-sm font-medium">
                          ★ {doctor.recommendationScore}
                        </span>
                      )}
                    </div>
                    <p className="text-teal-700 font-medium text-sm">{doctorTitle}</p>
                    <p className="line-clamp-2 text-sm text-slate-500 mt-2">
                      <span className="font-medium text-slate-600">{copy.browser.expertiseLabel}</span>
                      {doctorExpertise}
                    </p>
                  </div>
                  <Link
                    href={`/doctor/${doctor.id}`}
                    className="w-full sm:w-auto focus-visible:outline-none"
                  >
                    <Button className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">
                      <span className="inline-flex items-center justify-center gap-1">
                        {resolved === "en" ? "View Profile" : "查看医生主页"}
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </span>
                    </Button>
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
