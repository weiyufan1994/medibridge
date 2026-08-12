import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import {
  APPOINTMENT_INVALID_TRANSITION_ERROR,
  APPOINTMENT_NOT_ALLOWED_ERROR,
  APPOINTMENT_STATUS_VALUES,
  CHECKOUT_REINIT_ALLOWED_FROM,
  CHECKOUT_REINIT_BLOCKED_STATUSES,
  PAYMENT_STATUS_VALUES,
  ensureAppointmentStatusAllowsVisitV2,
  ensureValidAppointmentStatePair,
  ensureValidTransitionOrThrow,
  isAllowedPaymentStatusForAppointment,
  isAllowedStatusTransition,
  type AppointmentStatus,
  type PaymentStatus,
} from "./stateMachine";

const allowedTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  draft: ["draft", "pending_payment", "canceled"],
  pending_payment: ["pending_payment", "paid", "expired", "canceled"],
  paid: ["paid", "active", "ended", "completed", "refunded", "canceled"],
  active: ["active", "ended", "completed", "refunded", "canceled"],
  ended: ["ended", "completed", "refunded"],
  completed: ["completed", "refunded"],
  expired: ["expired"],
  refunded: ["refunded"],
  canceled: ["canceled"],
};

const allowedPaymentStatuses: Record<AppointmentStatus, PaymentStatus[]> = {
  draft: ["unpaid"],
  pending_payment: ["pending", "failed"],
  paid: ["paid"],
  active: ["paid"],
  ended: ["paid"],
  completed: ["paid"],
  expired: ["expired", "failed"],
  refunded: ["refunded"],
  canceled: ["canceled", "failed", "unpaid"],
};

function expectPreconditionFailure(action: () => void) {
  expect(action).toThrowError(
    expect.objectContaining<Partial<TRPCError>>({
      code: "PRECONDITION_FAILED",
      message: APPOINTMENT_INVALID_TRANSITION_ERROR,
    })
  );
}

describe("appointment state machine", () => {
  it("keeps checkout restart categories complete and disjoint", () => {
    expect(CHECKOUT_REINIT_ALLOWED_FROM).toEqual([
      "draft",
      "pending_payment",
      "expired",
      "canceled",
    ]);
    expect(CHECKOUT_REINIT_BLOCKED_STATUSES).toEqual([
      "paid",
      "active",
      "ended",
      "completed",
      "refunded",
    ]);
    expect(
      new Set([
        ...CHECKOUT_REINIT_ALLOWED_FROM,
        ...CHECKOUT_REINIT_BLOCKED_STATUSES,
      ])
    ).toEqual(new Set(APPOINTMENT_STATUS_VALUES));
  });

  it.each(APPOINTMENT_STATUS_VALUES)(
    "enforces every transition from %s",
    fromStatus => {
      for (const toStatus of APPOINTMENT_STATUS_VALUES) {
        expect(isAllowedStatusTransition(fromStatus, toStatus)).toBe(
          allowedTransitions[fromStatus].includes(toStatus)
        );
      }
    }
  );

  it.each(APPOINTMENT_STATUS_VALUES)(
    "enforces every payment pairing for %s",
    appointmentStatus => {
      for (const paymentStatus of PAYMENT_STATUS_VALUES) {
        expect(
          isAllowedPaymentStatusForAppointment(appointmentStatus, paymentStatus)
        ).toBe(
          allowedPaymentStatuses[appointmentStatus].includes(paymentStatus)
        );
      }
    }
  );

  it("accepts a valid appointment state pair", () => {
    expect(() =>
      ensureValidAppointmentStatePair({
        status: "active",
        paymentStatus: "paid",
      })
    ).not.toThrow();
  });

  it("rejects an invalid appointment state pair with the stable error", () => {
    expectPreconditionFailure(() =>
      ensureValidAppointmentStatePair({
        status: "active",
        paymentStatus: "pending",
      })
    );
  });

  it("accepts a valid transition and target payment state", () => {
    expect(() =>
      ensureValidTransitionOrThrow({
        fromStatus: "paid",
        toStatus: "active",
        toPaymentStatus: "paid",
      })
    ).not.toThrow();
  });

  it("rejects an invalid status transition before checking payment", () => {
    expectPreconditionFailure(() =>
      ensureValidTransitionOrThrow({
        fromStatus: "completed",
        toStatus: "active",
        toPaymentStatus: "paid",
      })
    );
  });

  it("rejects an invalid target payment state", () => {
    expectPreconditionFailure(() =>
      ensureValidTransitionOrThrow({
        fromStatus: "paid",
        toStatus: "active",
        toPaymentStatus: "pending",
      })
    );
  });

  it.each(["paid", "active", "ended", "completed"] as const)(
    "allows a paid %s appointment to enter a visit",
    status => {
      expect(() =>
        ensureAppointmentStatusAllowsVisitV2({
          status,
          paymentStatus: "paid",
        })
      ).not.toThrow();
    }
  );

  it("rejects an unpaid visit before considering appointment status", () => {
    expect(() =>
      ensureAppointmentStatusAllowsVisitV2({
        status: "active",
        paymentStatus: "pending",
      })
    ).toThrowError(
      expect.objectContaining<Partial<TRPCError>>({
        code: "FORBIDDEN",
        message: APPOINTMENT_NOT_ALLOWED_ERROR,
      })
    );
  });

  it("rejects a paid appointment whose status cannot enter a visit", () => {
    expect(() =>
      ensureAppointmentStatusAllowsVisitV2({
        status: "canceled",
        paymentStatus: "paid",
      })
    ).toThrowError(
      expect.objectContaining<Partial<TRPCError>>({
        code: "FORBIDDEN",
        message: APPOINTMENT_NOT_ALLOWED_ERROR,
      })
    );
  });
});
