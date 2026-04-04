import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { getSearchableText } from "@/lib/i18n";
import {
  buildDepartmentDoctorsInput,
  buildHospitalDepartmentsInput,
  buildHospitalsListInput,
  getHospitalBrowseText,
} from "@/features/hospitals/presentation";

export type HospitalsViewMode = "hospitals" | "departments" | "doctors";

export function useHospitals() {
  const [viewMode, setViewMode] = useState<HospitalsViewMode>("hospitals");
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | null>(
    null
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<
    number | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { resolved, reportInput } = useLanguage();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const hospitalId = Number(params.get("hospitalId") ?? NaN);
    const departmentId = Number(params.get("departmentId") ?? NaN);

    if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
      return;
    }

    setSelectedHospitalId(hospitalId);

    if (Number.isInteger(departmentId) && departmentId > 0) {
      setSelectedDepartmentId(departmentId);
      setViewMode("doctors");
      return;
    }

    setViewMode("departments");
  }, []);

  const { data: hospitals, isLoading: hospitalsLoading } =
    trpc.hospitals.getAll.useQuery(buildHospitalsListInput(resolved));

  const { data: departments, isLoading: departmentsLoading } =
    trpc.hospitals.getDepartments.useQuery(
      buildHospitalDepartmentsInput(selectedHospitalId!, resolved),
      { enabled: selectedHospitalId !== null }
    );

  const { data: doctors, isLoading: doctorsLoading } =
    trpc.doctors.getByDepartment.useQuery(
      buildDepartmentDoctorsInput(selectedDepartmentId!, resolved),
      { enabled: selectedDepartmentId !== null }
    );

  const selectedHospital = hospitals?.find(h => h.id === selectedHospitalId);
  const selectedDepartment = departments?.find(
    d => d.id === selectedDepartmentId
  );

  const selectedHospitalName = selectedHospital
    ? getHospitalBrowseText({
        lang: resolved,
        value: selectedHospital.name,
      })
    : "";

  const selectedHospitalLevel = selectedHospital
    ? getHospitalBrowseText({
        lang: resolved,
        value: selectedHospital.level,
      })
    : "";
  const selectedHospitalImageUrl = selectedHospital?.imageUrl ?? null;

  const selectedDepartmentName = selectedDepartment
    ? getHospitalBrowseText({
        lang: resolved,
        value: selectedDepartment.name,
      })
    : "";

  const filteredDoctors = useMemo(() => {
    return doctors?.filter(d => {
      const name = getHospitalBrowseText({
        lang: resolved,
        value: d.doctor.name,
      });
      const expertise = getHospitalBrowseText({
        lang: resolved,
        value: d.doctor.expertise,
      });
      const specialty = getHospitalBrowseText({
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
