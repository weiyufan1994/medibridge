import { ArrowRight, Hospital, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  HospitalBrowserLang,
  HospitalItem,
  HospitalsBrowserCopy,
} from "@/features/hospitals/hospitalBrowserTypes";
import { getHospitalBrowseText } from "@/features/hospitals/presentation";

type Props = {
  cityFilter: string;
  copy: HospitalsBrowserCopy["browser"];
  hospitals: HospitalItem[];
  isLoading: boolean;
  onCityFilterChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  onSelectHospital: (hospitalId: number) => void;
  resolved: HospitalBrowserLang;
  searchQuery: string;
};

export function HospitalsListView({
  cityFilter,
  copy,
  hospitals,
  isLoading,
  onCityFilterChange,
  onSearchQueryChange,
  onSelectHospital,
  resolved,
  searchQuery,
}: Props) {
  return (
    <section>
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">
          {copy.selectHospitalTitle}
        </h1>
        <p className="text-slate-500 mt-2">{copy.selectHospitalIntro}</p>
      </header>
      <div className="mb-8 flex flex-col sm:flex-row gap-4">
        <label htmlFor="hospital-search" className="sr-only">
          {copy.searchHospitalsLabel}
        </label>
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            id="hospital-search"
            placeholder={copy.searchHospitalsPlaceholder}
            value={searchQuery}
            onChange={event => onSearchQueryChange(event.target.value)}
            className="pl-9 h-11 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus-visible:ring-1 focus-visible:ring-teal-500 focus-visible:ring-offset-0"
          />
        </div>
        <label htmlFor="city-filter" className="sr-only">
          {copy.cityLabel}
        </label>
        <select
          id="city-filter"
          value={cityFilter}
          onChange={event => onCityFilterChange(event.target.value)}
          className="h-11 rounded-md border border-slate-200 bg-white px-3 text-slate-700 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 min-w-44"
        >
          <option value="all">{copy.allCities}</option>
          <option value="上海">{copy.shanghaiCity}</option>
        </select>
      </div>

      {isLoading ? (
        <div className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
        </div>
      ) : null}
      {!isLoading && hospitals.length === 0 ? (
        <p className="py-12 text-center text-slate-500">
          {copy.noHospitalsFound}
        </p>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-stretch">
        {hospitals.map(hospital => {
          const hospitalName = getHospitalBrowseText({
            lang: resolved,
            value: hospital.name,
          });
          const hospitalCity = getHospitalBrowseText({
            lang: resolved,
            value: hospital.city,
          });
          const hospitalLevel = getHospitalBrowseText({
            lang: resolved,
            value: hospital.level,
          });
          const hospitalImage = hospital.imageUrl?.trim();

          return (
            <article
              key={hospital.id}
              className="h-full bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow border border-slate-100 flex gap-5 items-start"
              aria-label={hospitalName}
            >
              <div className="w-24 h-24 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-500 text-xs">
                {hospitalImage ? (
                  <img
                    src={hospitalImage}
                    alt={hospitalName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Hospital
                    className="w-8 h-8 text-slate-400"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 flex flex-col">
                <h3 className="text-lg font-bold text-slate-900 line-clamp-2">
                  {hospitalName}
                </h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {hospital.level ? (
                    <Badge variant="outline">{hospitalLevel}</Badge>
                  ) : null}
                  {hospital.city ? (
                    <Badge variant="secondary">{hospitalCity}</Badge>
                  ) : null}
                </div>
                <p className="text-sm text-slate-500 line-clamp-2 mt-2">
                  {copy.hospitalCardDescription}
                </p>
                <div className="mt-auto pt-4">
                  <Button
                    type="button"
                    onClick={() => onSelectHospital(hospital.id)}
                    className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    {copy.viewDoctors}
                    <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
