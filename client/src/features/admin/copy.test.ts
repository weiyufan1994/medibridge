import { describe, expect, it } from "vitest";
import {
  getAdminConfirmationCopy,
  getAdminRoleCapabilitySummary,
  type AdminConfirmationKey,
} from "@/features/admin/copy";

const DANGEROUS_ACTIONS = [
  "reinitiatePayment",
  "retentionCleanup",
  "updateAppointmentStatus",
  "updateReferralStatus",
  "clearHospitalImage",
  "updateUserRole",
  "deleteScheduleRule",
  "deleteScheduleException",
  "cancelDoctorInvite",
  "revokeDoctorBinding",
  "initiateReferralRefund",
  "approveReferralRefund",
  "rejectReferralRefund",
] as const satisfies readonly AdminConfirmationKey[];

describe("admin action copy", () => {
  it.each(DANGEROUS_ACTIONS)(
    "provides a complete bilingual confirmation for %s",
    key => {
      for (const lang of ["zh", "en"] as const) {
        const copy = getAdminConfirmationCopy(lang, key);
        expect(copy.title.trim()).not.toBe("");
        expect(copy.description.trim()).not.toBe("");
        expect(copy.confirmLabel.trim()).not.toBe("");
        expect(copy.cancelLabel.trim()).not.toBe("");
      }
    }
  );

  it("describes only the existing role-level access model", () => {
    expect(getAdminRoleCapabilitySummary("admin", "en")).toContain(
      "every admin module"
    );
    expect(getAdminRoleCapabilitySummary("ops", "en")).toContain(
      "cannot change user roles"
    );
    expect(getAdminRoleCapabilitySummary("free", "en")).toContain("No access");
    expect(getAdminRoleCapabilitySummary("pro", "en")).toContain("No access");
  });
});
