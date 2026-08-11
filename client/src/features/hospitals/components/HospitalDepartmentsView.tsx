import { ChevronRight, Loader2, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  DepartmentItem,
  HospitalBrowserLang,
  HospitalsBrowserCopy,
} from "@/features/hospitals/hospitalBrowserTypes";
import { getHospitalBrowseText } from "@/features/hospitals/presentation";

const DEFAULT_HOSPITAL_IMAGE =
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=2000";

type Props = {
  copy: HospitalsBrowserCopy["browser"];
  departments?: DepartmentItem[];
  isLoading: boolean;
  onSelectDepartment: (departmentId: number) => void;
  resolved: HospitalBrowserLang;
  selectedHospitalImageUrl?: string | null;
  selectedHospitalLevel: string;
  selectedHospitalName: string;
};

export function HospitalDepartmentsView({
  copy,
  departments,
  isLoading,
  onSelectDepartment,
  resolved,
  selectedHospitalImageUrl,
  selectedHospitalLevel,
  selectedHospitalName,
}: Props) {
  return (
    <section>
      <img
        src={selectedHospitalImageUrl?.trim() || DEFAULT_HOSPITAL_IMAGE}
        alt={selectedHospitalName}
        className="w-full h-64 md:h-72 object-cover rounded-2xl shadow-sm mb-8"
      />
      <div className="pb-8 border-b border-slate-100">
        <div className="flex items-center gap-4 mb-2">
          <h2 className="text-3xl font-bold text-slate-900">
            {selectedHospitalName}
          </h2>
          {selectedHospitalLevel ? (
            <Badge
              variant="outline"
              className="border-slate-300 text-slate-600"
            >
              {selectedHospitalLevel}
            </Badge>
          ) : null}
        </div>
        <p className="text-slate-600 leading-relaxed mt-4 max-w-4xl">
          {copy.hospitalProfileDescription}
        </p>
        <p className="text-slate-500 leading-relaxed mt-3 max-w-4xl">
          {copy.departmentHeroSubtitle}
        </p>
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-6 mt-8">
        {copy.selectDepartmentTitle}
      </h3>

      {isLoading ? (
        <div className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : null}
      {!isLoading && !departments?.length ? (
        <p className="py-12 text-center text-slate-500">
          {copy.noDepartmentsFound}
        </p>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
        {departments?.map(department => {
          const departmentName = getHospitalBrowseText({
            lang: resolved,
            value: department.name,
          });
          return (
            <button
              key={department.id}
              type="button"
              onClick={() => onSelectDepartment(department.id)}
              aria-label={`${departmentName} ${copy.enterDepartment}`}
              className="h-full min-h-[88px] w-full text-left bg-white rounded-xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex items-start gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50"
            >
              <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 flex-shrink-0 transition-colors group-hover:bg-teal-600 group-hover:text-white">
                <Stethoscope className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800 group-hover:text-teal-700 transition-colors line-clamp-2 leading-tight">
                  {departmentName}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {copy.departmentCardSubtitle}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-teal-500 flex-shrink-0 self-start transition-colors" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
