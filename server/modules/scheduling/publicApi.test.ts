import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  getSlotById: vi.fn(),
  holdSlot: vi.fn(),
  attachHeldSlotToAppointment: vi.fn(),
  releaseHeldSlotByAppointmentId: vi.fn(),
  bookHeldSlotByAppointmentId: vi.fn(),
}));

import { schedulingSlotApi } from "./publicApi";
import * as repo from "./repo";

describe("schedulingSlotApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads a slot through the scheduling-owned repository", async () => {
    vi.mocked(repo.getSlotById).mockResolvedValue({ id: 17 } as never);

    await expect(schedulingSlotApi.getSlotById(17)).resolves.toEqual({
      id: 17,
    });
    expect(repo.getSlotById).toHaveBeenCalledWith(17);
  });

  it("holds and attaches a slot with the original transaction executor", async () => {
    const dbExecutor = {} as never;
    const holdInput = {
      slotId: 17,
      heldBySessionId: "booking-19",
      holdMinutes: 12,
      dbExecutor,
    };
    const attachInput = {
      slotId: 17,
      appointmentId: 23,
      heldBySessionId: "booking-19",
      dbExecutor,
    };
    vi.mocked(repo.holdSlot).mockResolvedValue({ id: 17 } as never);
    vi.mocked(repo.attachHeldSlotToAppointment).mockResolvedValue({
      id: 17,
    } as never);

    await expect(schedulingSlotApi.holdSlot(holdInput)).resolves.toEqual({
      id: 17,
    });
    await expect(
      schedulingSlotApi.attachHeldSlotToAppointment(attachInput)
    ).resolves.toEqual({ id: 17 });
    expect(repo.holdSlot).toHaveBeenCalledWith(holdInput);
    expect(repo.attachHeldSlotToAppointment).toHaveBeenCalledWith(attachInput);
  });

  it("releases and books a held slot by appointment id", async () => {
    const dbExecutor = {} as never;
    const input = { appointmentId: 23, dbExecutor };
    vi.mocked(repo.releaseHeldSlotByAppointmentId).mockResolvedValue(1);
    vi.mocked(repo.bookHeldSlotByAppointmentId).mockResolvedValue({
      id: 17,
    } as never);

    await expect(
      schedulingSlotApi.releaseHeldSlotByAppointmentId(input)
    ).resolves.toBe(1);
    await expect(
      schedulingSlotApi.bookHeldSlotByAppointmentId(input)
    ).resolves.toEqual({ id: 17 });
    expect(repo.releaseHeldSlotByAppointmentId).toHaveBeenCalledWith(input);
    expect(repo.bookHeldSlotByAppointmentId).toHaveBeenCalledWith(input);
  });
});
