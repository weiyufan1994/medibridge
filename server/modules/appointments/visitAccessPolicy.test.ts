import { afterEach, describe, expect, it, vi } from "vitest";
import { getVisitAccessPolicyFailure } from "./visitAccessPolicy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("visit access policy", () => {
  it("allows missing and invalid schedules rather than inventing a start time", () => {
    for (const scheduledAt of [null, new Date("invalid")]) {
      expect(
        getVisitAccessPolicyFailure({
          appointment: { status: "active", paymentStatus: "paid", scheduledAt },
          action: "join_room",
          now: new Date(),
        })
      ).toBeNull();
    }
  });

  it("never enables test-mode time bypass in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VISIT_ROOM_TEST_MODE", "true");
    expect(
      getVisitAccessPolicyFailure({
        appointment: {
          status: "active",
          paymentStatus: "paid",
          scheduledAt: new Date(Date.now() + 60_000),
        },
        action: "join_room",
        now: new Date(),
      })
    ).toBe("APPOINTMENT_NOT_STARTED");
  });
});
