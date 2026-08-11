import { describe, expect, it } from "vitest";
import {
  buildCurrentSessionSidebarTitle,
  buildTriageHistoryItems,
  mergeCurrentTriageHistoryItem,
} from "./triageHistory";

describe("triage history presentation", () => {
  it("groups sessions relative to the local day boundary", () => {
    const items = buildTriageHistoryItems(
      [
        {
          id: 1,
          title: "Today",
          status: "active",
          createdAt: "2026-08-11T03:00:00.000Z",
        },
        {
          id: 2,
          title: "Recent",
          status: "completed",
          createdAt: "2026-08-07T03:00:00.000Z",
        },
        {
          id: 3,
          title: "Older",
          status: "completed",
          createdAt: "2026-07-20T03:00:00.000Z",
        },
        {
          id: 4,
          title: "Invalid",
          status: "active",
          createdAt: "not-a-date",
        },
      ],
      new Date("2026-08-11T12:00:00+08:00")
    );
    expect(items.map(item => item.group)).toEqual([
      "today",
      "previous7",
      "older",
      "older",
    ]);
  });

  it("prefers a result summary, then normalized user copy, then fallback", () => {
    expect(
      buildCurrentSessionSidebarTitle({
        messages: [{ role: "user", content: "knee pain" }],
        triageResult: { summary: "  Result summary  " },
        fallbackTitle: "New",
      })
    ).toBe("Result summary");
    expect(
      buildCurrentSessionSidebarTitle({
        messages: [{ role: "user", content: "  knee\n pain  " }],
        triageResult: null,
        fallbackTitle: "New",
      })
    ).toBe("knee pain");
    expect(
      buildCurrentSessionSidebarTitle({
        messages: [],
        triageResult: null,
        fallbackTitle: "New",
      })
    ).toBe("New");
  });

  it("puts the current session first without duplicating it", () => {
    const existing = {
      id: 4,
      title: "Existing",
      status: "active" as const,
      group: "today" as const,
    };
    const current = { ...existing, title: "Current" };
    expect(mergeCurrentTriageHistoryItem([existing], current)).toEqual([
      current,
    ]);
  });
});
