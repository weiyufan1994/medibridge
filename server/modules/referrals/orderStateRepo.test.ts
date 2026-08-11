import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import {
  insertOperation,
  insertStatusEvent,
  markOrderPaymentFailed,
  markOrderPendingPayment,
  tryMarkOrderPaidByPaymentSessionId,
  tryTransitionOrderById,
  updateReferralOrderById,
} from "./orderStateRepo";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

type OrderState = {
  id: number;
  status: string;
  paymentStatus: string;
  paymentProviderSessionId: string | null;
};

function createTransitionDb(input: {
  states: Array<OrderState | null>;
  affectedRows?: number;
}) {
  const limit = vi.fn();
  for (const state of input.states) {
    limit.mockResolvedValueOnce(state ? [state] : []);
  }
  const updateWhere = vi.fn(async () => ({
    rowCount: input.affectedRows ?? 1,
  }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const insertValues = vi.fn(async () => undefined);
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit })),
      })),
    })),
    update: vi.fn(() => ({ set: updateSet })),
    insert: vi.fn(() => ({ values: insertValues })),
  };

  return { db, insertValues, limit, updateSet, updateWhere };
}

const pendingOrder: OrderState = {
  id: 61,
  status: "pending_payment",
  paymentStatus: "pending",
  paymentProviderSessionId: "session-61",
};

describe("referral order state repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not_found without attempting an update", async () => {
    const { db } = createTransitionDb({ states: [null] });

    await expect(
      tryTransitionOrderById({
        orderId: 404,
        allowedFrom: ["pending_payment"],
        toStatus: "paid_pending_assignment",
        toPaymentStatus: "paid",
        actorType: "webhook",
        dbExecutor: db as never,
      })
    ).resolves.toEqual({ ok: false, reason: "not_found" });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("rejects a status outside the caller allowlist before updating", async () => {
    const { db } = createTransitionDb({ states: [pendingOrder] });

    await expect(
      tryTransitionOrderById({
        orderId: pendingOrder.id,
        allowedFrom: ["assigned"],
        toStatus: "paid_pending_assignment",
        toPaymentStatus: "paid",
        actorType: "system",
        dbExecutor: db as never,
      })
    ).resolves.toMatchObject({ ok: false, reason: "illegal_transition" });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("reports a compare-and-set conflict without recording an event", async () => {
    const { db, insertValues } = createTransitionDb({
      states: [pendingOrder],
      affectedRows: 0,
    });

    await expect(
      tryTransitionOrderById({
        orderId: pendingOrder.id,
        allowedFrom: ["pending_payment"],
        toStatus: "paid_pending_assignment",
        toPaymentStatus: "paid",
        actorType: "webhook",
        dbExecutor: db as never,
      })
    ).resolves.toMatchObject({ ok: false, reason: "conflict" });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("atomically updates a valid transition and records its audit event", async () => {
    const { db, insertValues, updateSet } = createTransitionDb({
      states: [pendingOrder],
    });

    await expect(
      tryTransitionOrderById({
        orderId: pendingOrder.id,
        allowedFrom: ["pending_payment"],
        toStatus: "paid_pending_assignment",
        toPaymentStatus: "paid",
        actorType: "webhook",
        actorId: 62,
        reason: "payment_settled",
        update: { paymentProviderTransactionId: "txn-62" },
        dbExecutor: db as never,
      })
    ).resolves.toMatchObject({ ok: true, reason: "updated" });
    expect(updateSet).toHaveBeenCalledWith({
      status: "paid_pending_assignment",
      paymentStatus: "paid",
      updatedAt: expect.any(Date),
      paymentProviderTransactionId: "txn-62",
    });
    expect(insertValues).toHaveBeenCalledWith({
      orderId: pendingOrder.id,
      fromStatus: "pending_payment",
      toStatus: "paid_pending_assignment",
      actorType: "webhook",
      actorId: 62,
      reason: "payment_settled",
    });
  });

  it("keeps checkout-session attachment idempotent without a status event", async () => {
    const { db, insertValues, updateSet } = createTransitionDb({
      states: [pendingOrder],
    });

    await expect(
      markOrderPendingPayment({
        orderId: pendingOrder.id,
        paymentSessionId: "session-new",
        paymentProvider: "stripe",
        dbExecutor: db as never,
      })
    ).resolves.toMatchObject({ ok: true, reason: "updated" });
    expect(updateSet).toHaveBeenCalledWith({
      status: "pending_payment",
      paymentStatus: "pending",
      updatedAt: expect.any(Date),
      paymentProvider: "stripe",
      paymentProviderSessionId: "session-new",
    });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("records a failed payment with the default webhook actor", async () => {
    const { db, insertValues } = createTransitionDb({ states: [pendingOrder] });

    await markOrderPaymentFailed({
      orderId: pendingOrder.id,
      reason: "provider_declined",
      dbExecutor: db as never,
    });

    expect(insertValues).toHaveBeenCalledWith({
      orderId: pendingOrder.id,
      fromStatus: "pending_payment",
      toStatus: "pending_payment",
      actorType: "webhook",
      actorId: null,
      reason: "provider_declined",
    });
  });

  it("settles the order found by payment session with supplied metadata", async () => {
    const paidAt = new Date("2026-08-01T00:00:00.000Z");
    const fulfillmentDeadlineAt = new Date("2026-08-03T00:00:00.000Z");
    const { db, limit, updateSet } = createTransitionDb({
      states: [pendingOrder, pendingOrder],
    });

    await expect(
      tryMarkOrderPaidByPaymentSessionId({
        paymentSessionId: "session-61",
        actorType: "ops",
        reason: "manual_reconcile",
        paidAt,
        fulfillmentDeadlineAt,
        paymentProviderTransactionId: "txn-63",
        dbExecutor: db as never,
      })
    ).resolves.toMatchObject({ ok: true, reason: "updated" });
    expect(limit).toHaveBeenCalledTimes(2);
    expect(updateSet).toHaveBeenCalledWith({
      status: "paid_pending_assignment",
      paymentStatus: "paid",
      updatedAt: expect.any(Date),
      paidAt,
      fulfillmentDeadlineAt,
      paymentProviderTransactionId: "txn-63",
    });
  });

  it("uses order id zero when no payment session matches", async () => {
    const { db, limit } = createTransitionDb({ states: [null, null] });

    await expect(
      tryMarkOrderPaidByPaymentSessionId({
        paymentSessionId: "missing-session",
        dbExecutor: db as never,
      })
    ).resolves.toEqual({ ok: false, reason: "not_found" });
    expect(limit).toHaveBeenCalledTimes(2);
  });

  it("preserves generic update timestamps and affected-row results", async () => {
    const where = vi.fn(async () => ({ rowCount: 1 }));
    const set = vi.fn(() => ({ where }));
    const dbExecutor = { update: vi.fn(() => ({ set })) } as never;

    await expect(
      updateReferralOrderById({
        orderId: 64,
        update: { refundReason: "patient request" },
        dbExecutor,
      })
    ).resolves.toBe(1);
    expect(set).toHaveBeenCalledWith({
      refundReason: "patient request",
      updatedAt: expect.any(Date),
    });
  });

  it("preserves explicit status-event and operation audit payloads", async () => {
    const values = vi.fn(async () => undefined);
    const dbExecutor = { insert: vi.fn(() => ({ values })) } as never;

    await insertStatusEvent({
      orderId: 65,
      fromStatus: "assigned",
      toStatus: "contacting",
      actorType: "ops",
      actorId: 66,
      reason: "patient_contacted",
      dbExecutor,
    });
    await insertOperation({
      orderId: 65,
      operatorType: "ops",
      operatorId: 66,
      actionType: "contact_attempted",
      actionPayload: { channel: "phone" },
      dbExecutor,
    });

    expect(values).toHaveBeenNthCalledWith(1, {
      orderId: 65,
      fromStatus: "assigned",
      toStatus: "contacting",
      actorType: "ops",
      actorId: 66,
      reason: "patient_contacted",
    });
    expect(values).toHaveBeenNthCalledWith(2, {
      orderId: 65,
      operatorType: "ops",
      operatorId: 66,
      actionType: "contact_attempted",
      actionPayload: { channel: "phone" },
    });
  });
});
