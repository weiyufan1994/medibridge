import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn() }));
vi.mock("./repo", () => ({
  tryTransitionAppointmentById: vi.fn(),
}));

import { getDb } from "../../db";
import { startAppointmentAutoCloseWorker } from "./autoCloseWorker";

describe("appointment auto-close worker logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs tick failure without exception or appointment content", async () => {
    vi.mocked(getDb).mockRejectedValue(new Error("private appointment detail"));
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const stop = startAppointmentAutoCloseWorker({
      intervalMs: 1_000_000,
      runOnStart: true,
      createSystemMessage: vi.fn(),
    });
    await vi.waitFor(() => expect(consoleWarn).toHaveBeenCalled());
    stop();

    const serialized = String(consoleWarn.mock.calls.at(-1)?.[0]);
    expect(JSON.parse(serialized)).toMatchObject({
      component: "appointment-auto-close-worker",
      event: "tick_failed",
      errorName: "Error",
    });
    expect(serialized).not.toContain("private appointment detail");
  });
});
