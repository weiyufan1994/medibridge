import { describe, expect, it } from "vitest";
import { buildVisitRoomAccessQueryOptions } from "@/features/visit/hooks/useVisitRoomData";

describe("buildVisitRoomAccessQueryOptions", () => {
  it("keeps previous appointment data while language-specific query is fetching", () => {
    const options = buildVisitRoomAccessQueryOptions(true);
    const previous = { id: 1, triageSummary: "旧摘要" };

    expect(options.enabled).toBe(true);
    expect(options.refetchInterval).toBe(2000);
    expect(options.placeholderData?.(previous)).toBe(previous);
  });
});
