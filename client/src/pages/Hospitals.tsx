import { HospitalsPageHeader } from "@/features/hospitals/components/HospitalsPageHeader";
import { HospitalsBrowser } from "@/features/hospitals/components/HospitalsBrowser";
import { useHospitals } from "@/features/hospitals/hooks/useHospitals";

export default function Hospitals() {
  const {
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
  } = useHospitals();

  return (
    <div className="min-h-screen bg-slate-50">
      <HospitalsPageHeader />

      <div className="max-w-5xl mx-auto py-8 px-4">
        <HospitalsBrowser
          viewMode={viewMode}
          selectedHospitalName={selectedHospitalName}
          selectedDepartmentName={selectedDepartmentName}
          hospitals={hospitals}
          hospitalsLoading={hospitalsLoading}
          departments={departments}
          departmentsLoading={departmentsLoading}
          filteredDoctors={filteredDoctors}
          doctorsLoading={doctorsLoading}
          searchQuery={searchQuery}
          resolved={resolved}
          onSearchQueryChange={onSearchQueryChange}
          onSelectHospital={onSelectHospital}
          onSelectDepartment={onSelectDepartment}
          onBackToHospitals={onBackToHospitals}
          onBackToDepartments={onBackToDepartments}
        />
      </div>
    </div>
  );
}
