import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocalizedTextWithZhFallback, getSearchableText } from "@/lib/i18n";

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
    ? getLocalizedTextWithZhFallback({ lang: resolved, value: selectedHospital.name })
    : "";

  const selectedHospitalLevel = selectedHospital
    ? getLocalizedTextWithZhFallback({ lang: resolved, value: selectedHospital.level })
    : "";
  const selectedHospitalImageUrl = selectedHospital?.imageUrl ?? null;

  const selectedDepartmentName = selectedDepartment
    ? getLocalizedTextWithZhFallback({ lang: resolved, value: selectedDepartment.name })
    : "";

  const filteredDoctors = useMemo(() => {
    return doctors?.filter((d) => {
      const name = getLocalizedTextWithZhFallback({ lang: resolved, value: d.doctor.name });
      const expertise = getLocalizedTextWithZhFallback({
        lang: resolved,
        value: d.doctor.expertise,
      });
      const specialty = getLocalizedTextWithZhFallback({
        lang: resolved,
        value: d.doctor.specialty,
      });
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
