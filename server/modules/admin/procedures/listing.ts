import { TRPCError } from "@trpc/server";
import { adminOrOpsProcedure, adminProcedure } from "../../../_core/trpc";
import { appointmentsAdminApi } from "../../appointments/publicApi";
import * as adminRepo from "../repo";
import {
  adminAppointmentsInputSchema,
  adminUpdateUserRoleSchema,
  adminUsersInputSchema,
} from "../schemas";
import { normalizeAmountFilter, toDate } from "../support";

export const listingProcedures = {
  adminAppointments: adminOrOpsProcedure
    .input(adminAppointmentsInputSchema)
    .query(async ({ input }) => {
      return appointmentsAdminApi.listAppointmentsForAdmin({
        page: input.page,
        pageSize: input.pageSize,
        status: input.status,
        paymentStatus: input.paymentStatus,
        emailQuery: input.emailQuery,
        doctorId: input.doctorId,
        amountMin: normalizeAmountFilter(input.amountMin, "min"),
        amountMax: normalizeAmountFilter(input.amountMax, "max"),
        createdAtFrom: toDate(input.createdAtFrom),
        createdAtTo: toDate(input.createdAtTo),
        scheduledAtFrom: toDate(input.scheduledAtFrom),
        scheduledAtTo: toDate(input.scheduledAtTo),
        hasRisk: input.hasRisk,
        sortBy: input.sortBy,
        sortDirection: input.sortDirection,
      });
    }),

  adminUsers: adminProcedure
    .input(adminUsersInputSchema)
    .query(async ({ input }) => {
      return adminRepo.listAdminUsers({
        emailQuery: input.emailQuery,
        limit: input.limit,
      });
    }),

  adminUpdateUserRole: adminProcedure
    .input(adminUpdateUserRoleSchema)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.id === input.userId && input.role !== "admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove your own admin role",
        });
      }

      const updated = await adminRepo.updateAdminUserRole({
        userId: input.userId,
        role: input.role,
      });

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return updated;
    }),
};
