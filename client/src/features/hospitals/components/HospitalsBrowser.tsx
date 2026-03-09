import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Hospital,
  Stethoscope,
  Search,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  selectedDepartmentName: string;
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
  selectedDepartmentName,
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

  return (
    <div className="w-full">
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
              className={`hover:text-slate-900 transition-colors ${viewMode === "departments" ? "text-slate-900 font-semibold" : ""}`}
            >
              {selectedHospitalName || copy.browser.breadcrumbDepartmentsFallback}
            </button>
          </>
        )}
        {viewMode === "doctors" && (
          <>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">
              {selectedDepartmentName || copy.browser.breadcrumbDoctorsFallback}
            </span>
          </>
        )}
      </nav>

      {viewMode === "hospitals" && (
        <section>
          <header className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900">
              选择合作医院 (Select a Hospital)
            </h1>
            <p className="text-slate-500 mt-2">
              {resolved === "en"
                ? "Quickly find top medical institutions by name, tier, or city."
                : "支持搜索医院名称、等级与城市，快速找到顶尖医疗机构。"}
            </p>
          </header>
          <div className="mb-8 flex flex-col sm:flex-row gap-4">
            <label htmlFor="hospital-search" className="sr-only">
              {resolved === "en" ? "Search hospitals" : "搜索医院"}
            </label>
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                id="hospital-search"
                placeholder={resolved === "en" ? "Search hospitals..." : "搜索医院..."}
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                className="pl-9 h-11 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus-visible:ring-1 focus-visible:ring-teal-500 focus-visible:ring-offset-0"
              />
            </div>
            <label htmlFor="city-filter" className="sr-only">
              {resolved === "en" ? "City" : "城市"}
            </label>
            <select
              id="city-filter"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="h-11 rounded-md border border-slate-200 bg-white px-3 text-slate-700 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 min-w-44"
            >
              <option value="all">{resolved === "en" ? "All cities" : "全部城市"}</option>
              <option value="上海">上海</option>
            </select>
          </div>

          {hospitalsLoading && (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
            </div>
          )}
          {!hospitalsLoading && filteredHospitals.length === 0 && (
            <p className="py-12 text-center text-slate-500">
              {resolved === "en" ? "No hospitals found." : "未找到医院。"}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              const description =
                resolved === "en"
                  ? "A nationally recognized tertiary hospital with strong comprehensive care and specialist services in oral and maxillofacial medicine."
                  : "全国知名的综合性三甲医院，特色科室包含整形外科、口腔科、骨科等，具备完整的检查与术后随访体系。";

              return (
                <article
                  key={hospital.id}
                  className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow border border-slate-100 flex gap-5 items-start"
                  aria-label={hospitalName}
                >
                  <div className="w-24 h-24 rounded-xl bg-teal-50/50 flex-shrink-0 flex items-center justify-center text-teal-600/60 text-xs">
                    <Hospital className="w-8 h-8 text-teal-600/60" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-slate-900">{hospitalName}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {hospital.level && <Badge variant="outline">{hospitalLevel}</Badge>}
                      {hospital.city && <Badge variant="secondary">{hospitalCity}</Badge>}
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 mt-2">{description}</p>
                    <Button
                      type="button"
                      onClick={() => onSelectHospital(hospital.id)}
                      className="mt-4 bg-teal-600 hover:bg-teal-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      {resolved === "en" ? "View Doctors" : "查看医生"}
                      <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {viewMode === "departments" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="w-6 h-6 text-primary" />
                  {copy.browser.selectDepartmentTitle}
                </CardTitle>
                <CardDescription>
                  {selectedHospitalName}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={onBackToHospitals}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                {copy.browser.back}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {departmentsLoading && (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            )}
            {departments?.map((dept) => {
              const departmentName = getLocalizedField({
                lang: resolved,
                zh: dept.name,
                en: dept.nameEn,
              });
              return (
                <button
                  key={dept.id}
                  onClick={() => onSelectDepartment(dept.id)}
                  className="w-full text-left"
                >
                  <Card className="hover:shadow-md transition-shadow hover:border-primary/50">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">
                            {departmentName}
                          </h3>
                        </div>
                        <ChevronRight className="w-6 h-6 text-muted-foreground flex-shrink-0 ml-4" />
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {viewMode === "doctors" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <div>
                <CardTitle>{copy.browser.doctorsTitle}</CardTitle>
                <CardDescription>
                  {copy.browser.doctorsCountLabel(
                    selectedDepartmentName,
                    filteredDoctors?.length || 0
                  )}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={onBackToDepartments}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                {copy.browser.back}
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={copy.browser.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {doctorsLoading && (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            )}
            {filteredDoctors && filteredDoctors.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
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
              const doctorSpecialty = getLocalizedField({
                lang: resolved,
                zh: doctor.specialty,
                en: doctor.specialtyEn,
              });
              const doctorExpertise = getLocalizedField({
                lang: resolved,
                zh: doctor.expertise,
                en: doctor.expertiseEn,
              });
              return (
                <Card key={doctor.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-lg text-foreground">{doctorName}</h4>
                          {doctor.recommendationScore && (
                            <Badge variant="secondary" className="text-xs">
                              ★ {doctor.recommendationScore}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{doctorTitle}</p>
                        {doctor.specialty && (
                          <p className="text-sm text-muted-foreground mb-2">
                            <span className="font-medium">{copy.browser.specialtyLabel}</span>
                            {doctorSpecialty}
                          </p>
                        )}
                        {doctor.expertise && (
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            <span className="font-medium">{copy.browser.expertiseLabel}</span>
                            {doctorExpertise}
                          </p>
                        )}
                      </div>
                      <Link href={`/doctor/${doctor.id}`}>
                        <Button size="sm">
                          {copy.browser.viewProfile}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
