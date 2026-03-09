import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import TopHeader from "@/components/layout/TopHeader";
import { HospitalsBrowser } from "@/features/hospitals/components/HospitalsBrowser";
import { useHospitals } from "@/features/hospitals/hooks/useHospitals";
import { getHospitalsCopy } from "@/features/hospitals/copy";

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
  const copy = getHospitalsCopy(resolved);

  return (
    <div className="min-h-screen bg-slate-50">
      <TopHeader subtitle={copy.pageHeader.subtitle}>
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {copy.pageHeader.backToHome}
          </Button>
        </Link>
      </TopHeader>

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
