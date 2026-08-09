import { TRPCError } from "@trpc/server";
import * as repo from "./repo";

export type ResolveBoundDoctorIdInput = {
  userId: number;
  allowAdminDoctorId?: number;
  userRole?: string | null;
};

export async function resolveBoundDoctorIdForUser(
  input: ResolveBoundDoctorIdInput
): Promise<number> {
  const role = String(input.userRole ?? "");
  if ((role === "admin" || role === "ops") && input.allowAdminDoctorId) {
    return input.allowAdminDoctorId;
  }

  const binding = await repo.getActiveBindingByUserId(input.userId);
  if (!binding) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Doctor workbench is not enabled for the current account",
    });
  }
  return binding.doctorId;
}
