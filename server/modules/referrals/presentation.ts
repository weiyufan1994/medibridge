import type { LocalizedText } from "@shared/types";
import {
  departments,
  hospitals,
  referralContacts,
} from "../../../drizzle/schema";

type HospitalRow = typeof hospitals.$inferSelect;
type DepartmentRow = typeof departments.$inferSelect;
type ContactRow = typeof referralContacts.$inferSelect;

function toLocalizedText(
  zh: string | null | undefined,
  en: string | null | undefined
): LocalizedText {
  return {
    zh: zh ?? "",
    en: en ?? "",
  };
}

export function toPublicReferralHospital(hospital: HospitalRow) {
  return {
    id: hospital.id,
    name: toLocalizedText(hospital.name, hospital.nameEn),
    city: toLocalizedText(hospital.city, hospital.cityEn),
    level: toLocalizedText(hospital.level, hospital.levelEn),
    imageUrl: hospital.imageUrl ?? null,
    isActive: hospital.isActive === 1,
  };
}

export function toPublicReferralDepartment(department: DepartmentRow) {
  return {
    id: department.id,
    name: toLocalizedText(department.name, department.nameEn),
    isActive: department.isActive === 1,
  };
}

export function toReferralDisplayHospital(input: {
  hospital: HospitalRow | null;
  snapshotHospitalName?: string | null;
  snapshotCity?: string | null;
}) {
  if (input.hospital) {
    return {
      id: input.hospital.id,
      name: toLocalizedText(input.hospital.name, input.hospital.nameEn),
      city: toLocalizedText(input.hospital.city, input.hospital.cityEn),
      level: toLocalizedText(input.hospital.level, input.hospital.levelEn),
      imageUrl: input.hospital.imageUrl ?? null,
      isLocalCatalogMatch: true,
    };
  }

  const fallbackName = input.snapshotHospitalName ?? "";
  const fallbackCity = input.snapshotCity ?? "";

  return {
    id: null,
    name: toLocalizedText(fallbackName, fallbackName),
    city: toLocalizedText(fallbackCity, fallbackCity),
    level: toLocalizedText("", ""),
    imageUrl: null,
    isLocalCatalogMatch: false,
  };
}

export function toReferralDisplayDepartment(input: {
  department: DepartmentRow | null;
  snapshotDepartmentName?: string | null;
  snapshotDepartmentNameEn?: string | null;
}) {
  if (input.department) {
    return {
      id: input.department.id,
      name: toLocalizedText(input.department.name, input.department.nameEn),
      isLocalCatalogMatch: true,
    };
  }

  const fallbackZh = input.snapshotDepartmentName ?? "";
  const fallbackEn =
    input.snapshotDepartmentNameEn ?? input.snapshotDepartmentName ?? "";

  return {
    id: null,
    name: toLocalizedText(fallbackZh, fallbackEn),
    isLocalCatalogMatch: false,
  };
}

export function toPublicReferralContact(contact: ContactRow) {
  return {
    id: contact.id,
    hospitalId: contact.hospitalId,
    departmentId: contact.departmentId,
    name: contact.name,
    roleType: contact.roleType,
    languages: Array.isArray(contact.languages) ? contact.languages : [],
    specialtyTags: Array.isArray(contact.specialtyTags)
      ? contact.specialtyTags
      : [],
    avgResponseTimeMinutes: contact.avgResponseTimeMinutes ?? null,
    successRate: contact.successRate ?? null,
    isActive: contact.isActive === 1,
  };
}

export function toPublicReferralContactOrNull(contact: ContactRow | null) {
  return contact ? toPublicReferralContact(contact) : null;
}
