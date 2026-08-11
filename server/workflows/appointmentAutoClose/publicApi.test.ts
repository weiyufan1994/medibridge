import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../modules/appointments/publicApi", () => ({
  appointmentAutomationApi: {
    startAutoCloseWorker: vi.fn(() => vi.fn()),
  },
}));

vi.mock("../../modules/visit/publicApi", () => ({
  visitAutomationApi: {
    createMessage: vi.fn(),
  },
}));

import { appointmentAutomationApi } from "../../modules/appointments/publicApi";
import { visitAutomationApi } from "../../modules/visit/publicApi";
import { startAppointmentAutoCloseWorker } from "./publicApi";

describe("appointment auto-close workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("injects visit message creation into the appointment worker", () => {
    const stopWorker = startAppointmentAutoCloseWorker({
      intervalMs: 1_000,
      runOnStart: false,
    });

    expect(appointmentAutomationApi.startAutoCloseWorker).toHaveBeenCalledWith({
      intervalMs: 1_000,
      runOnStart: false,
      createSystemMessage: visitAutomationApi.createMessage,
    });
    expect(stopWorker).toEqual(expect.any(Function));
  });
});
