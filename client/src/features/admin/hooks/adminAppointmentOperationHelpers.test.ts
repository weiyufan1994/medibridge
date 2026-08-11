import { describe, expect, it } from "vitest";
import {
  buildAdminBatchMutationInput,
  isAdminBatchActionAllowed,
} from "./adminAppointmentOperationHelpers";

describe("buildAdminBatchMutationInput", () => {
  it("deduplicates ids, trims the reason, and preserves valid statuses", () => {
    expect(
      buildAdminBatchMutationInput(
        [4, 2, 4],
        {
          action: "update_status",
          toStatus: "active",
          toPaymentStatus: "paid",
          reason: "  reviewed  ",
          idempotencyKey: "provided-key",
        },
        () => "generated-key"
      )
    ).toEqual({
      appointmentIds: [4, 2],
      action: "update_status",
      toStatus: "active",
      toPaymentStatus: "paid",
      reason: "reviewed",
      idempotencyKey: "provided-key",
    });
  });

  it("omits invalid statuses and supplies existing defaults", () => {
    expect(
      buildAdminBatchMutationInput(
        [8],
        {
          action: "reinitiate_payment",
          toStatus: "invalid",
          toPaymentStatus: "invalid",
          reason: "   ",
        },
        () => "generated-key"
      )
    ).toEqual({
      appointmentIds: [8],
      action: "reinitiate_payment",
      toStatus: undefined,
      toPaymentStatus: undefined,
      reason: "admin_batch_action",
      idempotencyKey: "generated-key",
    });
  });
});

describe("isAdminBatchActionAllowed", () => {
  it("uses the access-link permission only for resend actions", () => {
    const permissions = {
      canMutateAdmin: false,
      canResendAccessLink: true,
    };
    expect(isAdminBatchActionAllowed("resend_access_link", permissions)).toBe(
      true
    );
    expect(isAdminBatchActionAllowed("reinitiate_payment", permissions)).toBe(
      false
    );
    expect(isAdminBatchActionAllowed("update_status", permissions)).toBe(false);
  });
});
