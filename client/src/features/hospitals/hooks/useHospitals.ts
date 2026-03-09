import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocalizedField, getSearchableText } from "@/lib/i18n";

export type HospitalsViewMode = "hospitals" | "departments" | "doctors";

export function useHospitals() {
  const [viewMode, setViewMode] = useState<HospitalsViewMode>("hospitals");
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { resolved, reportInput } = useLanguage();

  const { data: hospitals, isLoading: hospitalsLoading } = trpc.hospitals.getAll.useQuery();

  const { data: departments, isLoading: departmentsLoading } = trpc.hospitals.getDepartments.useQuery(
    { hospitalId: selectedHospitalId! },
    { enabled: selectedHospitalId !== null }
  );

  const { data: doctors, isLoading: doctorsLoading } = trpc.doctors.getByDepartment.useQuery(
    { departmentId: selectedDepartmentId!, limit: 50 },
    { enabled: selectedDepartmentId !== null }
  );

  const selectedHospital = hospitals?.find((h) => h.id === selectedHospitalId);
  const selectedDepartment = departments?.find((d) => d.id === selectedDepartmentId);

  const selectedHospitalName = selectedHospital
    ? getLocalizedField({ lang: resolved, zh: selectedHospital.name, en: selectedHospital.nameEn })
    : "";

  const selectedHospitalLevel = selectedHospital
    ? getLocalizedField({
        lang: resolved,
        zh: selectedHospital.level,
        en: selectedHospital.levelEn,
      })
    : "";
  const selectedHospitalImageUrl = selectedHospital?.imageUrl ?? null;

  const selectedDepartmentName = selectedDepartment
    ? getLocalizedField({ lang: resolved, zh: selectedDepartment.name, en: selectedDepartment.nameEn })
    : "";

  const filteredDoctors = useMemo(() => {
    return doctors?.filter((d) => {
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
  }, [doctors, resolved, searchQuery]);

  const onSelectHospital = (hospitalId: number) => {
    setSelectedHospitalId(hospitalId);
    setViewMode("departments");
    setSearchQuery("");
  };

  const onSelectDepartment = (departmentId: number) => {
    setSelectedDepartmentId(departmentId);
    setViewMode("doctors");
    setSearchQuery("");
  };

  const onBackToDepartments = () => {
    setViewMode("departments");
    setSelectedDepartmentId(null);
    setSearchQuery("");
  };

  const onBackToHospitals = () => {
    setViewMode("hospitals");
    setSelectedHospitalId(null);
    setSelectedDepartmentId(null);
    setSearchQuery("");
  };

  const onSearchQueryChange = (value: string) => {
    setSearchQuery(value);
    reportInput(value);
  };

  return {
    viewMode,
    selectedHospitalName,
    selectedHospitalLevel,
    selectedHospitalImageUrl,
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
  };
}
