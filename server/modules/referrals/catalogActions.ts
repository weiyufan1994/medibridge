import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminStaffDirectoryApi } from "../admin/publicApi";
import * as referralRepo from "./repo";
import {
  toPublicReferralContact,
  toPublicReferralDepartment,
  toPublicReferralHospital,
} from "./presentation";
import type {
  upsertContactInputSchema,
  upsertHospitalInputSchema,
} from "./schemas";

type UpsertHospitalInput = z.infer<typeof upsertHospitalInputSchema>;
type UpsertContactInput = z.infer<typeof upsertContactInputSchema>;

export async function listReferralContactsForAdminAction(input?: {
  hospitalId?: number;
}) {
  const rows = await referralRepo.listReferralContactsForAdmin(input);
  return rows.map(toPublicReferralContact);
}

export async function listReferralHospitalsForAdminAction() {
  const rows = await referralRepo.listHospitalsForReferralCatalog();
  return rows.map(toPublicReferralHospital);
}

export async function listReferralDepartmentsForAdminAction(
  hospitalId: number
) {
  const rows = await referralRepo.listDepartmentsByHospitalId(hospitalId);
  return rows.map(toPublicReferralDepartment);
}

export async function listAssignableAgentsAction() {
  return adminStaffDirectoryApi.listAssignableStaff();
}

export async function upsertHospitalAction(input: UpsertHospitalInput) {
  const hospital = await referralRepo.upsertHospital(input);
  if (!hospital) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to save hospital",
    });
  }
  return toPublicReferralHospital(hospital);
}

export async function upsertContactAction(input: UpsertContactInput) {
  const contact = await referralRepo.upsertReferralContact({
    values: {
      id: input.id,
      hospitalId: input.hospitalId,
      departmentId: input.departmentId,
      name: input.name,
      roleType: input.roleType,
      languages: input.languages,
      specialtyTags: input.specialtyTags,
      avgResponseTimeMinutes: input.avgResponseTimeMinutes ?? null,
      successRate: input.successRate ?? null,
      isActive: input.isActive ? 1 : 0,
      internalNotes: input.internalNotes ?? null,
    },
  });
  if (!contact) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to save referral contact",
    });
  }
  return toPublicReferralContact(contact);
}

export async function updateHospitalActiveAction(input: {
  hospitalId: number;
  isActive: boolean;
}) {
  const affected = await referralRepo.updateHospitalActive(input);
  if (affected !== 1) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Hospital not found",
    });
  }
  const hospital = await referralRepo.getHospitalById(input.hospitalId);
  if (!hospital) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Hospital not found",
    });
  }
  return toPublicReferralHospital(hospital);
}

export async function updateContactActiveAction(input: {
  contactId: number;
  isActive: boolean;
}) {
  const affected = await referralRepo.updateReferralContactActive(input);
  if (affected !== 1) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral contact not found",
    });
  }
  const contact = await referralRepo.getContactById(input.contactId);
  if (!contact) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral contact not found",
    });
  }
  return toPublicReferralContact(contact);
}
