import { beforeEach, describe, expect, it, vi } from "vitest";
import { tryTransitionAppointmentById } from "./lifecycleRepo";

function buildExecutor(input: {
  status: string;
  paymentStatus: string;
  affectedRows?: number;
}) {
  const insertValues = vi.fn(async () => undefined);
  const updateWhere = vi.fn(async () => ({
    rowCount: input.affectedRows ?? 1,
  }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const selectLimit = vi.fn(async () => [
    {
      id: 101,
      status: input.status,
      paymentStatus: input.paymentStatus,
      stripeSessionId: "cs_test_101",
    },
  ]);

  return {
    executor: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: selectLimit })),
        })),
      })),
      update: vi.fn(() => ({ set: updateSet })),
      insert: vi.fn(() => ({ values: insertValues })),
    },
    insertValues,
    updateSet,
  };
}

describe("appointment lifecycle repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates a legal state/payment pair and records the audit event", async () => {
    const { executor, insertValues, updateSet } = buildExecutor({
      status: "pending_payment",
      paymentStatus: "pending",
    });

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
    const { executor, insertValues, updateSet } = buildExecutor({
      status: "pending_payment",
      paymentStatus: "pending",
    });

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
});
