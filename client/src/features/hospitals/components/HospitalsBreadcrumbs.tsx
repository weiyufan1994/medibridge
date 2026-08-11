import { ChevronRight } from "lucide-react";
import type {
  HospitalsBrowserCopy,
  ViewMode,
} from "@/features/hospitals/hospitalBrowserTypes";

type Props = {
  copy: HospitalsBrowserCopy["browser"];
  onBackToDepartments: () => void;
  onBackToHospitals: () => void;
  selectedDepartmentName: string;
  selectedHospitalName: string;
  viewMode: ViewMode;
};

export function HospitalsBreadcrumbs({
  copy,
  onBackToDepartments,
  onBackToHospitals,
  selectedDepartmentName,
  selectedHospitalName,
  viewMode,
}: Props) {
  return (
    <nav
      aria-label={copy.navigationAria}
      className="flex items-center gap-2 mb-6 text-sm text-slate-500"
    >
      <button
        onClick={onBackToHospitals}
        type="button"
        className={`hover:text-slate-900 transition-colors ${viewMode === "hospitals" ? "text-slate-900 font-semibold" : ""}`}
      >
        {copy.breadcrumbHospitals}
      </button>
      {viewMode !== "hospitals" ? (
        <>
          <ChevronRight className="w-4 h-4" />
          <button
            onClick={onBackToDepartments}
            type="button"
            className={`hover:text-slate-900 transition-colors ${
              viewMode === "departments" ? "text-slate-900 font-semibold" : ""
            }`}
          >
            {selectedHospitalName || copy.breadcrumbDepartmentsFallback}
          </button>
          {viewMode === "doctors" ? (
            <>
              <ChevronRight className="w-4 h-4" />
              <span className="text-foreground font-medium">
                {selectedDepartmentName || copy.breadcrumbDoctorsFallback}
              </span>
            </>
          ) : null}
        </>
      ) : null}
    </nav>
  );
}
