import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Hospital, Stethoscope, Search, ChevronRight, ChevronLeft, Loader2, RefreshCw } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocalizedField, getSearchableText } from "@/lib/i18n";

type ViewMode = "hospitals" | "departments" | "doctors";

export default function Hospitals() {
  const [viewMode, setViewMode] = useState<ViewMode>("hospitals");
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { resolved, reportInput } = useLanguage();
  const utils = trpc.useUtils();

  const { data: hospitals, isLoading: hospitalsLoading } = trpc.hospitals.getAll.useQuery();
  
  const { data: departments, isLoading: departmentsLoading } = trpc.hospitals.getDepartments.useQuery(
    { hospitalId: selectedHospitalId! },
    { enabled: selectedHospitalId !== null }
  );

  const { data: doctors, isLoading: doctorsLoading } = trpc.doctors.getByDepartment.useQuery(
    { departmentId: selectedDepartmentId!, limit: 50 },
    { enabled: selectedDepartmentId !== null }
  );

  const selectedHospital = hospitals?.find(h => h.id === selectedHospitalId);
  const selectedDepartment = departments?.find(d => d.id === selectedDepartmentId);
  const selectedHospitalName = selectedHospital
    ? getLocalizedField({ lang: resolved, zh: selectedHospital.name, en: selectedHospital.nameEn })
    : "";
  const selectedDepartmentName = selectedDepartment
    ? getLocalizedField({ lang: resolved, zh: selectedDepartment.name, en: selectedDepartment.nameEn })
    : "";

  const filteredDoctors = doctors?.filter(d => {
    const name = resolved === "zh" ? d.doctor.name : d.doctor.nameEn || "";
    const expertise = resolved === "zh" ? d.doctor.expertise : d.doctor.expertiseEn || "";
    const specialty = resolved === "zh" ? d.doctor.specialty : d.doctor.specialtyEn || "";
    const query = searchQuery.toLowerCase();
    return (
      getSearchableText(name).includes(query) ||
      getSearchableText(expertise).includes(query) ||
      getSearchableText(specialty).includes(query)
    );
  });

  const handleSelectHospital = (hospitalId: number) => {
    setSelectedHospitalId(hospitalId);
    setViewMode("departments");
    setSearchQuery("");
  };

  const handleSelectDepartment = (departmentId: number) => {
    setSelectedDepartmentId(departmentId);
    setViewMode("doctors");
    setSearchQuery("");
  };

  const handleBackToDepartments = () => {
    setViewMode("departments");
    setSelectedDepartmentId(null);
    setSearchQuery("");
  };

  const handleBackToHospitals = () => {
    setViewMode("hospitals");
    setSelectedHospitalId(null);
    setSelectedDepartmentId(null);
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Stethoscope className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">MediBridge</h1>
                <p className="text-sm text-muted-foreground">Browse Hospitals & Doctors</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  utils.hospitals.getAll.invalidate();
                  utils.hospitals.getDepartments.invalidate();
                  utils.doctors.getByDepartment.invalidate();
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <LanguageSwitcher />
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
            <button
              onClick={handleBackToHospitals}
              className={`hover:text-foreground transition-colors ${viewMode === "hospitals" ? "text-foreground font-medium" : ""}`}
            >
              Hospitals
            </button>
            {viewMode !== "hospitals" && (
              <>
                <ChevronRight className="w-4 h-4" />
                <button
                  onClick={handleBackToDepartments}
                  className={`hover:text-foreground transition-colors ${viewMode === "departments" ? "text-foreground font-medium" : ""}`}
                >
                  {selectedHospitalName || "Departments"}
                </button>
              </>
            )}
            {viewMode === "doctors" && (
              <>
                <ChevronRight className="w-4 h-4" />
                <span className="text-foreground font-medium">
                  {selectedDepartmentName || "Doctors"}
                </span>
              </>
            )}
          </div>

          {/* Hospitals View */}
          {viewMode === "hospitals" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hospital className="w-6 h-6 text-primary" />
                  Select a Hospital
                </CardTitle>
                <CardDescription>
                  Choose from {hospitals?.length || 0} premier hospitals in Shanghai
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
                      onClick={() => handleSelectHospital(hospital.id)}
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

          {/* Departments View */}
          {viewMode === "departments" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Stethoscope className="w-6 h-6 text-primary" />
                      Select a Department
                    </CardTitle>
                    <CardDescription>
                      {selectedHospitalName}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleBackToHospitals}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
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
                      onClick={() => handleSelectDepartment(dept.id)}
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

          {/* Doctors View */}
          {viewMode === "doctors" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <CardTitle>Doctors</CardTitle>
                    <CardDescription>
                      {selectedDepartmentName} • {filteredDoctors?.length || 0} doctors
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleBackToDepartments}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or expertise..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      reportInput(e.target.value);
                    }}
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
                    <p className="text-sm">No doctors found</p>
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
                                <span className="font-medium">Specialty: </span>
                                {doctorSpecialty}
                              </p>
                            )}
                            {doctor.expertise && (
                              <p className="text-sm text-muted-foreground line-clamp-3">
                                <span className="font-medium">Expertise: </span>
                                {doctorExpertise}
                              </p>
                            )}
                          </div>
                          <Link href={`/doctor/${doctor.id}`}>
                            <Button size="sm">
                              View Profile
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
      </div>
    </div>
  );
}
