import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import { updateAppointmentNotesIfMatch } from "./notesWriteRepo";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

function buildExecutor(affectedRows: number) {
  const where = vi.fn(async () => ({ rowCount: affectedRows }));
  const set = vi.fn(() => ({ where }));
  vi.mocked(getDb).mockResolvedValue({
    update: vi.fn(() => ({ set })),
  } as never);
  return { set, where };
}

describe("appointment notes compare-and-set repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates notes when the expected null value still matches", async () => {
    const { set, where } = buildExecutor(1);

    await expect(
      updateAppointmentNotesIfMatch({
        appointmentId: 801,
        expectedNotes: null,
        nextNotes: "extended:15",
      })
    ).resolves.toBe(1);
    expect(set).toHaveBeenCalledWith({
      notes: "extended:15",
      updatedAt: expect.any(Date),
    });
    expect(where).toHaveBeenCalledTimes(1);
  });

  it("returns zero when the expected existing notes no longer match", async () => {
    buildExecutor(0);

    await expect(
      updateAppointmentNotesIfMatch({
        appointmentId: 802,
        expectedNotes: "extended:15",
        nextNotes: "extended:30",
      })
    ).resolves.toBe(0);
  });
});
