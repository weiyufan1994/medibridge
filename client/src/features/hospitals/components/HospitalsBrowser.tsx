import { useMemo, useState } from "react";
import { HospitalDepartmentsView } from "@/features/hospitals/components/HospitalDepartmentsView";
import { HospitalDoctorsView } from "@/features/hospitals/components/HospitalDoctorsView";
import { HospitalsBreadcrumbs } from "@/features/hospitals/components/HospitalsBreadcrumbs";
import { HospitalsListView } from "@/features/hospitals/components/HospitalsListView";
import { getHospitalsCopy } from "@/features/hospitals/copy";
import type { HospitalsBrowserProps } from "@/features/hospitals/hospitalBrowserTypes";
import { filterHospitalBrowseItems } from "@/features/hospitals/presentation";

export type { ViewMode } from "@/features/hospitals/hospitalBrowserTypes";

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
}: HospitalsBrowserProps) {
  const copy = getHospitalsCopy(resolved);
  const [cityFilter, setCityFilter] = useState<"all" | string>("上海");
  const filteredHospitals = useMemo(
    () =>
      filterHospitalBrowseItems({
        hospitals,
        cityFilter,
        searchQuery,
        lang: resolved,
      }),
    [cityFilter, hospitals, resolved, searchQuery]
  );

  return (
    <div
      className={
        viewMode === "doctors" ? "min-h-screen bg-slate-50 w-full" : "w-full"
      }
    >
      <HospitalsBreadcrumbs
        copy={copy.browser}
        onBackToDepartments={onBackToDepartments}
        onBackToHospitals={onBackToHospitals}
        selectedDepartmentName={selectedDepartmentName}
        selectedHospitalName={selectedHospitalName}
        viewMode={viewMode}
      />

      {viewMode === "hospitals" ? (
        <HospitalsListView
          cityFilter={cityFilter}
          copy={copy.browser}
          hospitals={filteredHospitals}
          isLoading={hospitalsLoading}
          onCityFilterChange={setCityFilter}
          onSearchQueryChange={onSearchQueryChange}
          onSelectHospital={onSelectHospital}
          resolved={resolved}
          searchQuery={searchQuery}
        />
      ) : null}
      {viewMode === "departments" ? (
        <HospitalDepartmentsView
          copy={copy.browser}
          departments={departments}
          isLoading={departmentsLoading}
          onSelectDepartment={onSelectDepartment}
          resolved={resolved}
          selectedHospitalImageUrl={selectedHospitalImageUrl}
          selectedHospitalLevel={selectedHospitalLevel}
          selectedHospitalName={selectedHospitalName}
        />
      ) : null}
      {viewMode === "doctors" ? (
        <HospitalDoctorsView
          copy={copy.browser}
          doctors={filteredDoctors}
          isLoading={doctorsLoading}
          onSearchQueryChange={onSearchQueryChange}
          resolved={resolved}
          searchQuery={searchQuery}
          selectedDepartmentName={selectedDepartmentName}
        />
      ) : null}
    </div>
  );
}
