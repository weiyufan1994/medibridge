import { describe, expect, it } from "vitest";
import type { ProcedureAccess } from "./_core/trpc";
import { systemRouter } from "./routers/system";

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
});
