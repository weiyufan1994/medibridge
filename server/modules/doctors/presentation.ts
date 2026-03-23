import type { LocalizedText } from "@shared/types";
import {
  departments,
  doctors,
  hospitals,
} from "../../../drizzle/schema";
import type { DoctorSearchResult } from "./repo";

type DoctorRow = typeof doctors.$inferSelect;
type HospitalRow = typeof hospitals.$inferSelect;
type DepartmentRow = typeof departments.$inferSelect;

export type PublicLocalizedDoctor = Omit<
  DoctorRow,
  | "name"
  | "nameEn"
  | "title"
  | "titleEn"
  | "specialty"
  | "specialtyEn"
  | "expertise"
  | "expertiseEn"
  | "onlineConsultation"
  | "onlineConsultationEn"
  | "appointmentAvailable"
  | "appointmentAvailableEn"
  | "satisfactionRate"
  | "satisfactionRateEn"
  | "attitudeScore"
  | "attitudeScoreEn"
> & {
  name: LocalizedText;
  title: LocalizedText;
  specialty: LocalizedText;
  expertise: LocalizedText;
  onlineConsultation: LocalizedText;
  appointmentAvailable: LocalizedText;
  satisfactionRate: LocalizedText;
  attitudeScore: LocalizedText;
};

export type PublicLocalizedHospital = Omit<
  HospitalRow,
  "name" | "nameEn" | "city" | "cityEn" | "level" | "levelEn" | "address" | "addressEn"
> & {
  name: LocalizedText;
  city: LocalizedText;
  level: LocalizedText;
  address: LocalizedText;
};

export type PublicLocalizedDepartment = Omit<DepartmentRow, "name" | "nameEn"> & {
  name: LocalizedText;
};

export type PublicLocalizedDoctorSearchResult = {
  doctor: PublicLocalizedDoctor;
  hospital: PublicLocalizedHospital;
  department: PublicLocalizedDepartment;
};

export type PublicLocalizedDoctorRecommendation = PublicLocalizedDoctorSearchResult & {
  reason: LocalizedText;
  title: LocalizedText;
  specialty: LocalizedText;
  biography: LocalizedText;
  yearsOfExperience: number | null;
};

function toLocalizedText(zh: string | null | undefined, en: string | null | undefined): LocalizedText {
  return {
    zh: zh ?? "",
    en: en ?? "",
  };
}

export function toPublicLocalizedDoctor(doctor: DoctorRow): PublicLocalizedDoctor {
  const {
    name,
    nameEn,
    title,
    titleEn,
    specialty,
    specialtyEn,
    expertise,
    expertiseEn,
    onlineConsultation,
    onlineConsultationEn,
    appointmentAvailable,
    appointmentAvailableEn,
    satisfactionRate,
    satisfactionRateEn,
    attitudeScore,
    attitudeScoreEn,
    ...rest
  } = doctor;

  return {
    ...rest,
    name: toLocalizedText(name, nameEn),
    title: toLocalizedText(title, titleEn),
    specialty: toLocalizedText(specialty, specialtyEn),
    expertise: toLocalizedText(expertise, expertiseEn),
    onlineConsultation: toLocalizedText(onlineConsultation, onlineConsultationEn),
    appointmentAvailable: toLocalizedText(appointmentAvailable, appointmentAvailableEn),
    satisfactionRate: toLocalizedText(satisfactionRate, satisfactionRateEn),
    attitudeScore: toLocalizedText(attitudeScore, attitudeScoreEn),
  };
}

export function toPublicLocalizedHospital(hospital: HospitalRow): PublicLocalizedHospital {
  const { name, nameEn, city, cityEn, level, levelEn, address, addressEn, ...rest } =
    hospital;

  return {
    ...rest,
    name: toLocalizedText(name, nameEn),
    city: toLocalizedText(city, cityEn),
    level: toLocalizedText(level, levelEn),
    address: toLocalizedText(address, addressEn),
  };
}

export function toPublicLocalizedDepartment(
  department: DepartmentRow
): PublicLocalizedDepartment {
  const { name, nameEn, ...rest } = department;

  return {
    ...rest,
    name: toLocalizedText(name, nameEn),
  };
}

export function toPublicLocalizedDoctorSearchResult(
  result: DoctorSearchResult
): PublicLocalizedDoctorSearchResult {
  return {
    doctor: toPublicLocalizedDoctor(result.doctor),
    hospital: toPublicLocalizedHospital(result.hospital),
    department: toPublicLocalizedDepartment(result.department),
  };
}

export function toLocalizedTextValue(
  zh: string | null | undefined,
  en: string | null | undefined
): LocalizedText {
  return toLocalizedText(zh, en);
}
