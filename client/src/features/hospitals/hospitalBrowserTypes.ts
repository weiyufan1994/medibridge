import { getHospitalsCopy } from "@/features/hospitals/copy";
import type { LocalizedText } from "@shared/types";

export type ViewMode = "hospitals" | "departments" | "doctors";
export type HospitalBrowserLang = "zh" | "en";
export type HospitalsBrowserCopy = ReturnType<typeof getHospitalsCopy>;

export type HospitalItem = {
  id: number;
  name: LocalizedText;
  city: LocalizedText;
  level: LocalizedText;
  imageUrl: string | null;
};

export type DepartmentItem = {
  id: number;
  name: LocalizedText;
};

export type DoctorItem = {
  id: number;
  name: LocalizedText;
  title: LocalizedText;
  specialty: LocalizedText;
  expertise: LocalizedText;
  recommendationScore: string | number | null;
};

export type DoctorWithDepartment = {
  doctor: DoctorItem;
};

export type HospitalsBrowserProps = {
  viewMode: ViewMode;
  selectedHospitalName: string;
  selectedHospitalLevel: string;
  selectedDepartmentName: string;
  selectedHospitalImageUrl?: string | null;
  hospitals?: HospitalItem[];
  hospitalsLoading: boolean;
  departments?: DepartmentItem[];
  departmentsLoading: boolean;
  filteredDoctors?: DoctorWithDepartment[];
  doctorsLoading: boolean;
  searchQuery: string;
  resolved: HospitalBrowserLang;
  onSearchQueryChange: (value: string) => void;
  onSelectHospital: (hospitalId: number) => void;
  onSelectDepartment: (departmentId: number) => void;
  onBackToHospitals: () => void;
  onBackToDepartments: () => void;
};
