import { Link } from "wouter";
import { Hospital, Stethoscope, Search, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getLocalizedField } from "@/lib/i18n";
import { hospitalsCopy } from "@/features/hospitals/copy";

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
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
        <button
          onClick={onBackToHospitals}
          className={`hover:text-foreground transition-colors ${viewMode === "hospitals" ? "text-foreground font-medium" : ""}`}
        >
          {hospitalsCopy.browser.breadcrumbHospitals}
        </button>
        {viewMode !== "hospitals" && (
          <>
            <ChevronRight className="w-4 h-4" />
            <button
              onClick={onBackToDepartments}
              className={`hover:text-foreground transition-colors ${viewMode === "departments" ? "text-foreground font-medium" : ""}`}
            >
              {selectedHospitalName || hospitalsCopy.browser.breadcrumbDepartmentsFallback}
            </button>
          </>
        )}
        {viewMode === "doctors" && (
          <>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">
              {selectedDepartmentName || hospitalsCopy.browser.breadcrumbDoctorsFallback}
            </span>
          </>
        )}
      </div>

      {viewMode === "hospitals" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hospital className="w-6 h-6 text-primary" />
              {hospitalsCopy.browser.selectHospitalTitle}
            </CardTitle>
            <CardDescription>
              {hospitalsCopy.browser.selectHospitalDescription(hospitals?.length || 0)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {hospitalsLoading && (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            )}
            {hospitals?.map((hospital) => {
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
              return (
                <button
                  key={hospital.id}
                  onClick={() => onSelectHospital(hospital.id)}
                  className="w-full text-left"
                >
                  <Card className="hover:shadow-md transition-shadow hover:border-primary/50">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-foreground mb-1">
                            {hospitalName}
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {hospital.level && (
                              <Badge variant="outline">{hospitalLevel}</Badge>
                            )}
                            {hospital.city && (
                              <Badge variant="secondary">{hospitalCity}</Badge>
                            )}
                          </div>
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

      {viewMode === "departments" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="w-6 h-6 text-primary" />
                  {hospitalsCopy.browser.selectDepartmentTitle}
                </CardTitle>
                <CardDescription>
                  {selectedHospitalName}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={onBackToHospitals}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                {hospitalsCopy.browser.back}
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
                <CardTitle>{hospitalsCopy.browser.doctorsTitle}</CardTitle>
                <CardDescription>
                  {hospitalsCopy.browser.doctorsCountLabel(
                    selectedDepartmentName,
                    filteredDoctors?.length || 0
                  )}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={onBackToDepartments}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                {hospitalsCopy.browser.back}
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={hospitalsCopy.browser.searchPlaceholder}
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
                <p className="text-sm">{hospitalsCopy.browser.noDoctorsFound}</p>
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
                            <span className="font-medium">{hospitalsCopy.browser.specialtyLabel}</span>
                            {doctorSpecialty}
                          </p>
                        )}
                        {doctor.expertise && (
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            <span className="font-medium">{hospitalsCopy.browser.expertiseLabel}</span>
                            {doctorExpertise}
                          </p>
                        )}
                      </div>
                      <Link href={`/doctor/${doctor.id}`}>
                        <Button size="sm">
                          {hospitalsCopy.browser.viewProfile}
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
