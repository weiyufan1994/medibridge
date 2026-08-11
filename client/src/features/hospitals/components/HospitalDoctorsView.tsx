import { ArrowRight, Loader2, Search, Stethoscope } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  DoctorWithDepartment,
  HospitalBrowserLang,
  HospitalsBrowserCopy,
} from "@/features/hospitals/hospitalBrowserTypes";
import { getHospitalBrowseText } from "@/features/hospitals/presentation";

type Props = {
  copy: HospitalsBrowserCopy["browser"];
  doctors?: DoctorWithDepartment[];
  isLoading: boolean;
  onSearchQueryChange: (value: string) => void;
  resolved: HospitalBrowserLang;
  searchQuery: string;
  selectedDepartmentName: string;
};

export function HospitalDoctorsView({
  copy,
  doctors,
  isLoading,
  onSearchQueryChange,
  resolved,
  searchQuery,
  selectedDepartmentName,
}: Props) {
  return (
    <section className="max-w-5xl mx-auto py-8 px-4">
      <h2 className="text-3xl font-bold text-slate-900">
        {selectedDepartmentName || copy.doctorsTitle}
      </h2>
      <p className="text-slate-500 mt-1 mb-5">
        {copy.doctorsCountLabel(doctors?.length || 0)}
      </p>
      <div className="relative mb-6">
        <label htmlFor="doctor-search" className="sr-only">
          {copy.searchDoctorsLabel}
        </label>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          id="doctor-search"
          placeholder={copy.searchPlaceholder}
          value={searchQuery}
          onChange={event => onSearchQueryChange(event.target.value)}
          className="pl-10 pr-4 py-3 rounded-xl shadow-sm border-slate-200 focus:border-teal-500 focus-visible:ring-1 focus-visible:ring-teal-500 focus-visible:ring-offset-0"
        />
      </div>
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          </div>
        ) : null}
        {doctors && doctors.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <p className="text-sm">{copy.noDoctorsFound}</p>
          </div>
        ) : null}
        {doctors?.map(({ doctor }) => {
          const doctorName = getHospitalBrowseText({
            lang: resolved,
            value: doctor.name,
          });
          const doctorTitle = getHospitalBrowseText({
            lang: resolved,
            value: doctor.title,
          });
          const doctorExpertise = getHospitalBrowseText({
            lang: resolved,
            value: doctor.expertise,
          });
          return (
            <article
              key={doctor.id}
              className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 mb-4 flex flex-col sm:flex-row gap-6 items-start sm:items-center"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-teal-50 flex-shrink-0 flex items-center justify-center text-teal-600 border border-slate-200 overflow-hidden">
                <Stethoscope className="w-8 h-8" aria-hidden="true" />
              </div>
              <div className="flex-1 flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h4 className="text-xl font-bold text-slate-900">
                    {doctorName}
                  </h4>
                  {doctor.recommendationScore ? (
                    <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded text-sm font-medium">
                      ★ {doctor.recommendationScore}
                    </span>
                  ) : null}
                </div>
                <p className="text-teal-700 font-medium text-sm">
                  {doctorTitle}
                </p>
                <p className="line-clamp-2 text-sm text-slate-500 mt-2">
                  <span className="font-medium text-slate-600">
                    {copy.expertiseLabel}
                  </span>
                  {doctorExpertise}
                </p>
              </div>
              <Link
                href={`/doctor/${doctor.id}`}
                className="w-full sm:w-auto focus-visible:outline-none"
              >
                <Button className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">
                  <span className="inline-flex items-center justify-center gap-1">
                    {copy.viewDoctorHomepage}
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </span>
                </Button>
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
