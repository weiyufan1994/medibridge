import { describe, expect, it } from "vitest";
import { canJoinRoom, canSendMessage } from "./chatPolicy";
import {
  APPOINTMENT_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
} from "./stateMachine";

const joinableStatuses = new Set(["paid", "active", "ended", "completed"]);
const writableStatuses = new Set(["paid", "active"]);

describe("appointment chat policy", () => {
  it.each(APPOINTMENT_STATUS_VALUES)(
    "permits joining only a paid visit in the %s state",
    status => {
      expect(canJoinRoom({ status, paymentStatus: "paid" })).toBe(
        joinableStatuses.has(status)
      );
    }
  );

  it.each(PAYMENT_STATUS_VALUES.filter(status => status !== "paid"))(
    "rejects joining when payment is %s",
    paymentStatus => {
      expect(canJoinRoom({ status: "active", paymentStatus })).toBe(false);
    }
  );

  it.each(APPOINTMENT_STATUS_VALUES)(
    "permits sending only while a paid visit is writable in the %s state",
    status => {
      expect(canSendMessage({ status, paymentStatus: "paid" })).toBe(
        writableStatuses.has(status)
      );
    }
  );

  it("rejects sending when payment is not paid", () => {
    expect(canSendMessage({ status: "active", paymentStatus: "pending" })).toBe(
      false
    );
  });
});
