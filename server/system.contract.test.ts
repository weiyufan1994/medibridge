import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import type { ProcedureAccess } from "./_core/trpc";
import {
  healthInputSchema,
  notifyOwnerInputSchema,
} from "./modules/admin/procedures/base";
import {
  adminAppointmentActionInputSchema,
  adminAppointmentDetailInputSchema,
  adminAppointmentsInputSchema,
  adminAppointmentScheduleUpdateSchema,
  adminAppointmentStatusUpdateSchema,
  adminBatchAppointmentActionSchema,
  adminExportSchema,
  adminHospitalImageClearSchema,
  adminHospitalImageUploadSchema,
  adminNotifyDoctorFollowupInputSchema,
  adminOperationAuditInputSchema,
  adminSummaryInputSchema,
  adminSummaryPdfInputSchema,
  adminTriageRiskEventsInputSchema,
  adminTriageSessionsInputSchema,
  adminUpdateUserRoleSchema,
  adminUsersInputSchema,
  adminWebhookReplaySchema,
  retentionCleanupAuditListSchema,
  retentionCleanupRunSchema,
  retentionPolicyUpsertSchema,
} from "./modules/admin/schemas";
import { systemRouter } from "./routers/system";
import "./system.contract-types";

type ProcedureType = "mutation" | "query";

interface ExpectedProcedureContract {
  access: ProcedureAccess;
  type: ProcedureType;
}

const expectedSystemContract = {
  adminAppointmentDetail: { access: "adminOrOps", type: "query" },
  adminAppointments: { access: "adminOrOps", type: "query" },
  adminBatchAppointmentsAction: { access: "adminOrOps", type: "mutation" },
  adminClearHospitalImage: { access: "admin", type: "mutation" },
  adminExport: { access: "adminOrOps", type: "mutation" },
  adminExportVisitSummaryPdf: { access: "admin", type: "mutation" },
  adminGenerateVisitSummary: { access: "admin", type: "mutation" },
  adminGetVisitSummary: { access: "adminOrOps", type: "query" },
  adminHospitals: { access: "adminOrOps", type: "query" },
  adminIssueAccessLinks: { access: "adminOrOps", type: "mutation" },
  adminNotifyDoctorFollowup: { access: "adminOrOps", type: "mutation" },
  adminOperationAudit: { access: "adminOrOps", type: "query" },
  adminReinitiatePayment: { access: "admin", type: "mutation" },
  adminResendAccessLink: { access: "adminOrOps", type: "mutation" },
  adminRetentionCleanupAudits: { access: "adminOrOps", type: "query" },
  adminRetentionPolicies: { access: "adminOrOps", type: "query" },
  adminRunRetentionCleanup: { access: "admin", type: "mutation" },
  adminTriageRiskEvents: { access: "adminOrOps", type: "query" },
  adminTriageSessions: { access: "adminOrOps", type: "query" },
  adminUpdateAppointmentSchedule: { access: "admin", type: "mutation" },
  adminUpdateAppointmentStatus: { access: "admin", type: "mutation" },
  adminUpdateUserRole: { access: "admin", type: "mutation" },
  adminUploadHospitalImage: { access: "admin", type: "mutation" },
  adminUpsertRetentionPolicy: { access: "admin", type: "mutation" },
  adminUsers: { access: "admin", type: "query" },
  adminWebhookReplay: { access: "adminOrOps", type: "mutation" },
  health: { access: "public", type: "query" },
  metrics: { access: "adminOrOps", type: "query" },
  notifyOwner: { access: "admin", type: "mutation" },
} satisfies Record<string, ExpectedProcedureContract>;

const validInputs = {
  adminAppointmentDetail: {
    schema: adminAppointmentDetailInputSchema,
    value: { appointmentId: 1 },
  },
  adminAppointments: {
    schema: adminAppointmentsInputSchema,
    value: { page: 1, pageSize: 50, sortBy: "createdAt" },
  },
  adminBatchAppointmentsAction: {
    schema: adminBatchAppointmentActionSchema,
    value: { action: "resend_access_link", appointmentIds: [1] },
  },
  adminClearHospitalImage: {
    schema: adminHospitalImageClearSchema,
    value: { hospitalId: 1 },
  },
  adminExport: {
    schema: adminExportSchema,
    value: { scope: "appointments", format: "csv" },
  },
  adminExportVisitSummaryPdf: {
    schema: adminSummaryPdfInputSchema,
    value: { appointmentId: 1, lang: "en" },
  },
  adminGenerateVisitSummary: {
    schema: adminSummaryInputSchema,
    value: { appointmentId: 1, forceRegenerate: true },
  },
  adminGetVisitSummary: {
    schema: adminAppointmentDetailInputSchema,
    value: { appointmentId: 1 },
  },
  adminIssueAccessLinks: {
    schema: adminAppointmentActionInputSchema,
    value: { appointmentId: 1 },
  },
  adminNotifyDoctorFollowup: {
    schema: adminNotifyDoctorFollowupInputSchema,
    value: { appointmentId: 1 },
  },
  adminOperationAudit: {
    schema: adminOperationAuditInputSchema,
    value: { page: 1, pageSize: 20 },
  },
  adminReinitiatePayment: {
    schema: adminAppointmentActionInputSchema,
    value: { appointmentId: 1 },
  },
  adminResendAccessLink: {
    schema: adminAppointmentActionInputSchema,
    value: { appointmentId: 1 },
  },
  adminRetentionCleanupAudits: {
    schema: retentionCleanupAuditListSchema,
    value: { limit: 20 },
  },
  adminRunRetentionCleanup: {
    schema: retentionCleanupRunSchema,
    value: { dryRun: true },
  },
  adminTriageRiskEvents: {
    schema: adminTriageRiskEventsInputSchema,
    value: { limit: 50 },
  },
  adminTriageSessions: {
    schema: adminTriageSessionsInputSchema,
    value: { limit: 50, status: "active" },
  },
  adminUpdateAppointmentSchedule: {
    schema: adminAppointmentScheduleUpdateSchema,
    value: {
      appointmentId: 1,
      scheduledAt: "2026-03-01T10:00:00.000Z",
      reason: "manual_schedule",
    },
  },
  adminUpdateAppointmentStatus: {
    schema: adminAppointmentStatusUpdateSchema,
    value: {
      appointmentId: 1,
      toStatus: "active",
      toPaymentStatus: "paid",
      reason: "start_visit",
    },
  },
  adminUpdateUserRole: {
    schema: adminUpdateUserRoleSchema,
    value: { userId: 1, role: "ops" },
  },
  adminUploadHospitalImage: {
    schema: adminHospitalImageUploadSchema,
    value: {
      hospitalId: 1,
      imageBase64: "aW1hZ2U=",
      contentType: "image/png",
    },
  },
  adminUpsertRetentionPolicy: {
    schema: retentionPolicyUpsertSchema,
    value: { tier: "paid", retentionDays: 180, enabled: true },
  },
  adminUsers: {
    schema: adminUsersInputSchema,
    value: { emailQuery: "patient@example.com", limit: 50 },
  },
  adminWebhookReplay: {
    schema: adminWebhookReplaySchema,
    value: { eventId: "evt_123" },
  },
  health: { schema: healthInputSchema, value: { timestamp: 0 } },
  notifyOwner: {
    schema: notifyOwnerInputSchema,
    value: { title: "title", content: "content" },
  },
} as const;

const invalidInputs = {
  adminAppointmentDetail: { appointmentId: 0 },
  adminAppointments: { page: 0 },
  adminBatchAppointmentsAction: {
    action: "update_status",
    appointmentIds: [1],
  },
  adminClearHospitalImage: { hospitalId: -1 },
  adminExport: { scope: "unsupported" },
  adminExportVisitSummaryPdf: { appointmentId: 1, lang: "fr" },
  adminGenerateVisitSummary: { appointmentId: 0 },
  adminGetVisitSummary: { appointmentId: 0 },
  adminIssueAccessLinks: { appointmentId: 0 },
  adminNotifyDoctorFollowup: { appointmentId: 0 },
  adminOperationAudit: { pageSize: 201 },
  adminReinitiatePayment: { appointmentId: 0 },
  adminResendAccessLink: { appointmentId: 0 },
  adminRetentionCleanupAudits: { limit: 201 },
  adminRunRetentionCleanup: { dryRun: "yes" },
  adminTriageRiskEvents: { limit: 0 },
  adminTriageSessions: { status: "closed" },
  adminUpdateAppointmentSchedule: { appointmentId: 1, scheduledAt: "bad" },
  adminUpdateAppointmentStatus: {
    appointmentId: 1,
    toStatus: "unknown",
    toPaymentStatus: "paid",
    reason: "ok",
  },
  adminUpdateUserRole: { userId: 1, role: "owner" },
  adminUploadHospitalImage: { hospitalId: 1, imageBase64: "" },
  adminUpsertRetentionPolicy: { tier: "paid", retentionDays: 0 },
  adminUsers: { limit: 201 },
  adminWebhookReplay: {},
  health: { timestamp: -1 },
  notifyOwner: { title: "", content: "content" },
} as const;

function createCaller(role?: "admin" | "ops" | "free") {
  return systemRouter.createCaller({
    user: role ? { id: 99, role } : null,
    req: { headers: {} },
  } as never);
}

async function expectTrpcError(
  operation: Promise<unknown>,
  code: "FORBIDDEN" | "BAD_REQUEST"
) {
  await expect(operation).rejects.toMatchObject<TRPCError>({ code });
}

describe("system router contract", () => {
  it("keeps procedure names, operation types, and access levels stable", () => {
    const actualContract = Object.fromEntries(
      Object.entries(systemRouter._def.procedures).map(([name, procedure]) => [
        name,
        {
          access: procedure._def.meta?.access,
          type: procedure._def.type,
        },
      ])
    );

    expect(actualContract).toEqual(expectedSystemContract);
  });

  it("keeps representative input schemas accepting valid contracts", () => {
    expect(Object.keys(validInputs).sort()).toEqual(
      Object.keys(expectedSystemContract)
        .filter(
          name =>
            !["adminHospitals", "adminRetentionPolicies", "metrics"].includes(
              name
            )
        )
        .sort()
    );

    for (const { schema, value } of Object.values(validInputs)) {
      expect(schema.safeParse(value).success).toBe(true);
    }
  });

  it("keeps representative malformed inputs rejected", () => {
    expect(Object.keys(invalidInputs).sort()).toEqual(
      Object.keys(validInputs).sort()
    );

    for (const [name, value] of Object.entries(invalidInputs)) {
      const schema = validInputs[name as keyof typeof validInputs].schema;
      expect(schema.safeParse(value).success, name).toBe(false);
    }
  });

  it("keeps public access limited to health", async () => {
    await expect(createCaller().health({ timestamp: 0 })).resolves.toEqual({
      ok: true,
    });
    await expectTrpcError(createCaller().metrics(), "FORBIDDEN");
  });

  it("keeps adminOrOps and admin-only permission boundaries", async () => {
    await expectTrpcError(createCaller("free").metrics(), "FORBIDDEN");
    await expectTrpcError(
      createCaller("ops").adminClearHospitalImage({ hospitalId: 1 }),
      "FORBIDDEN"
    );
    await expectTrpcError(
      createCaller("admin").adminClearHospitalImage({ hospitalId: 0 }),
      "BAD_REQUEST"
    );
  });
});
