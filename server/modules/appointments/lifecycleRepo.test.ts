import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

import { getDb } from "../../db";
import {
  insertStatusEvent,
  markAppointmentPendingPayment,
  recordIllegalStatusTransition,
  tryMarkPaidByStripeSessionId,
  tryTransitionAppointmentById,
  tryTransitionAppointmentByStripeSessionId,
} from "./lifecycleRepo";

const baseNow = new Date("2026-08-13T00:00:00.000Z");

type AppointmentState = {
  id: number;
  status: string;
  paymentStatus: string;
  stripeSessionId: string | null;
};

function buildExecutor(input: {
  rows?: Array<AppointmentState | null>;
  affectedRows?: number;
}) {
  const insertValues = vi.fn(async () => undefined);
  const updateWhere = vi.fn(async () => ({
    rowCount: input.affectedRows ?? 1,
  }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const rows = input.rows ?? [
    {
      id: 101,
      status: "pending_payment",
      paymentStatus: "pending",
      stripeSessionId: "cs_test_101",
    },
  ];
  let selectIndex = 0;
  const selectLimit = vi.fn(async () => {
    const row = rows[Math.min(selectIndex, rows.length - 1)] ?? null;
    selectIndex += 1;
    return row ? [row] : [];
  });
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({ limit: selectLimit })),
    })),
  }));

  return {
    executor: {
      select,
      update: vi.fn(() => ({ set: updateSet })),
      insert: vi.fn(() => ({ values: insertValues })),
    },
    select,
    selectLimit,
    insertValues,
    updateSet,
    updateWhere,
  };
}

describe("appointment lifecycle repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates a legal state/payment pair and records the audit event", async () => {
    const { executor, insertValues, updateSet } = buildExecutor({});

    const result = await tryTransitionAppointmentById({
      appointmentId: 101,
      allowedFrom: ["pending_payment"],
      toStatus: "paid",
      toPaymentStatus: "paid",
      operatorType: "webhook",
      reason: "payment_captured",
      payloadJson: { eventId: "evt_101" },
      dbExecutor: executor as never,
    });

    expect(result).toEqual(
      expect.objectContaining({ ok: true, reason: "updated" })
    );
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "paid",
        paymentStatus: "paid",
      })
    );
    expect(insertValues).toHaveBeenCalledWith({
      appointmentId: 101,
      fromStatus: "pending_payment",
      toStatus: "paid",
      operatorType: "webhook",
      operatorId: null,
      reason: "payment_captured",
      payloadJson: { eventId: "evt_101" },
    });
  });

  it("does not update an illegal transition and records the attempt", async () => {
    const { executor, insertValues, updateSet } = buildExecutor({});

    const result = await tryTransitionAppointmentById({
      appointmentId: 101,
      allowedFrom: ["draft"],
      toStatus: "paid",
      toPaymentStatus: "paid",
      operatorType: "admin",
      operatorId: 9,
      payloadJson: { source: "test" },
      dbExecutor: executor as never,
    });

    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: "illegal_transition" })
    );
    expect(updateSet).not.toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith({
      appointmentId: 101,
      fromStatus: "pending_payment",
      toStatus: "pending_payment",
      operatorType: "admin",
      operatorId: 9,
      reason: "illegal_transition_attempt",
      payloadJson: {
        attemptedStatus: "paid",
        attemptedPaymentStatus: "paid",
        source: "test",
      },
    });
  });

  it("returns not_found without writes when the appointment is absent", async () => {
    const { executor, updateSet, insertValues } = buildExecutor({
      rows: [null],
    });

    await expect(
      tryTransitionAppointmentById({
        appointmentId: 404,
        allowedFrom: ["draft"],
        toStatus: "pending_payment",
        toPaymentStatus: "pending",
        operatorType: "system",
        dbExecutor: executor as never,
      })
    ).resolves.toEqual({ ok: false, reason: "not_found" });
    expect(updateSet).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("returns conflict without an audit event when the guarded update loses", async () => {
    const { executor, updateSet, insertValues } = buildExecutor({
      affectedRows: 0,
    });

    await expect(
      tryTransitionAppointmentById({
        appointmentId: 101,
        allowedFrom: ["pending_payment"],
        toStatus: "paid",
        toPaymentStatus: "paid",
        operatorType: "webhook",
        dbExecutor: executor as never,
      })
    ).resolves.toMatchObject({ ok: false, reason: "conflict" });
    expect(updateSet).toHaveBeenCalledTimes(1);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("allows an idempotent state pair update without duplicating an event", async () => {
    const { executor, updateSet, insertValues } = buildExecutor({});

    await expect(
      tryTransitionAppointmentById({
        appointmentId: 101,
        allowedFrom: ["pending_payment"],
        toStatus: "pending_payment",
        toPaymentStatus: "pending",
        operatorType: "system",
        update: { stripeSessionId: "cs_reused" },
        dbExecutor: executor as never,
      })
    ).resolves.toMatchObject({ ok: true, reason: "updated" });
    expect(updateSet).toHaveBeenCalledWith({
      status: "pending_payment",
      paymentStatus: "pending",
      updatedAt: baseNow,
      stripeSessionId: "cs_reused",
    });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "forbidden status jump",
      toStatus: "completed" as const,
      toPaymentStatus: "paid" as const,
    },
    {
      name: "invalid status and payment pair",
      toStatus: "paid" as const,
      toPaymentStatus: "pending" as const,
    },
  ])("records $name as an illegal transition", async transition => {
    const { executor, updateSet, insertValues } = buildExecutor({});

    await expect(
      tryTransitionAppointmentById({
        appointmentId: 101,
        allowedFrom: ["pending_payment"],
        toStatus: transition.toStatus,
        toPaymentStatus: transition.toPaymentStatus,
        operatorType: "admin",
        dbExecutor: executor as never,
      })
    ).resolves.toMatchObject({ ok: false, reason: "illegal_transition" });
    expect(updateSet).not.toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledTimes(1);
  });

  it("normalizes a primitive illegal-transition payload", async () => {
    const { executor, insertValues } = buildExecutor({});

    await recordIllegalStatusTransition({
      appointmentId: 102,
      fromStatus: "draft",
      attemptedStatus: "paid",
      attemptedPaymentStatus: "paid",
      operatorType: "patient",
      payloadJson: "ignored",
      dbExecutor: executor as never,
    });

    expect(insertValues).toHaveBeenCalledWith({
      appointmentId: 102,
      fromStatus: "draft",
      toStatus: "draft",
      operatorType: "patient",
      operatorId: null,
      reason: "illegal_transition_attempt",
      payloadJson: {
        attemptedStatus: "paid",
        attemptedPaymentStatus: "paid",
      },
    });
  });

  it("returns not_found for an unknown Stripe session", async () => {
    const { executor, updateSet } = buildExecutor({ rows: [null] });

    await expect(
      tryTransitionAppointmentByStripeSessionId({
        stripeSessionId: "cs_missing",
        allowedFrom: ["pending_payment"],
        toStatus: "paid",
        toPaymentStatus: "paid",
        operatorType: "webhook",
        dbExecutor: executor as never,
      })
    ).resolves.toEqual({ ok: false, reason: "not_found" });
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("transitions by Stripe session and enriches the audit payload", async () => {
    const { executor, insertValues } = buildExecutor({});

    await expect(
      tryTransitionAppointmentByStripeSessionId({
        stripeSessionId: "cs_test_101",
        allowedFrom: ["pending_payment"],
        toStatus: "paid",
        toPaymentStatus: "paid",
        operatorType: "webhook",
        payloadJson: { eventId: "evt_paid" },
        dbExecutor: executor as never,
      })
    ).resolves.toMatchObject({ ok: true, reason: "updated" });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        payloadJson: {
          stripeSessionId: "cs_test_101",
          eventId: "evt_paid",
        },
      })
    );
  });

  it("marks checkout pending with the default Stripe provider", async () => {
    const draft: AppointmentState = {
      id: 103,
      status: "draft",
      paymentStatus: "unpaid",
      stripeSessionId: null,
    };
    const db = buildExecutor({ rows: [draft] });
    vi.mocked(getDb).mockResolvedValue(db.executor as never);

    await expect(
      markAppointmentPendingPayment({
        appointmentId: 103,
        stripeSessionId: "cs_checkout",
      })
    ).resolves.toMatchObject({ ok: true, reason: "updated" });
    expect(db.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending_payment",
        paymentStatus: "pending",
        stripeSessionId: "cs_checkout",
        paymentProvider: "stripe",
      })
    );
  });

  it("marks a Stripe session paid with explicit webhook metadata", async () => {
    const paidAt = new Date("2026-08-13T00:30:00.000Z");
    const db = buildExecutor({});

    await expect(
      tryMarkPaidByStripeSessionId({
        stripeSessionId: "cs_test_101",
        paidAt,
        operatorType: "admin",
        reason: "manual_capture",
        payloadJson: { eventId: "evt_manual" },
        dbExecutor: db.executor as never,
      })
    ).resolves.toBe(1);
    expect(db.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "paid", paymentStatus: "paid", paidAt })
    );
    expect(db.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorType: "admin",
        reason: "manual_capture",
        payloadJson: {
          stripeSessionId: "cs_test_101",
          eventId: "evt_manual",
        },
      })
    );
  });

  it("returns zero when a paid transition cannot find the session", async () => {
    const db = buildExecutor({ rows: [null] });

    await expect(
      tryMarkPaidByStripeSessionId({
        stripeSessionId: "cs_missing",
        dbExecutor: db.executor as never,
      })
    ).resolves.toBe(0);
  });

  it("normalizes optional status-event fields to null", async () => {
    const db = buildExecutor({});

    await insertStatusEvent({
      appointmentId: 104,
      fromStatus: null,
      toStatus: "draft",
      operatorType: "system",
      dbExecutor: db.executor as never,
    });

    expect(db.insertValues).toHaveBeenCalledWith({
      appointmentId: 104,
      fromStatus: null,
      toStatus: "draft",
      operatorType: "system",
      operatorId: null,
      reason: null,
      payloadJson: null,
    });
  });
});
