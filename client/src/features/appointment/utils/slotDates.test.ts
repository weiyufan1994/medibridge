import { describe, expect, it } from "vitest";
import { buildSlotGroups, getSlotDateKey } from "./slotDates";

describe("slotDates", () => {
  it("uses server-provided localDate as the date key", () => {
    expect(
      getSlotDateKey({
        id: 1,
        localDate: "2026-03-17",
      })
    ).toBe("2026-03-17");
  });

  it("groups slots by localDate instead of client-side Date parsing", () => {
    const groups = buildSlotGroups([
      {
        id: 1,
        localDate: "2026-03-17",
      },
      {
        id: 2,
        localDate: "2026-03-17",
      },
      {
        id: 3,
        localDate: "2026-03-18",
      },
    ]);

    expect(Array.from(groups.keys())).toEqual(["2026-03-17", "2026-03-18"]);
    expect(groups.get("2026-03-17")?.map(slot => slot.id)).toEqual([1, 2]);
    expect(groups.get("2026-03-18")?.map(slot => slot.id)).toEqual([3]);
  });
});
