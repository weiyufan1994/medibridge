import { describe, expect, it } from "vitest";
import {
  buildSanitizedVisitRoomLocation,
  readVisitRoomAccessToken,
} from "./useVisitRoomAccess";

describe("visit room access URL compatibility", () => {
  it("reads an existing visit-link token from the URL", () => {
    expect(
      readVisitRoomAccessToken({
        search: "?lang=en&t=legacy-appointment-token",
        historyState: null,
      })
    ).toBe("legacy-appointment-token");
  });

  it("removes the token from the visible URL and keeps refresh-only state", () => {
    const sanitized = buildSanitizedVisitRoomLocation({
      href: "https://medibridge.test/visit/42?lang=en&t=raw-token#room",
      historyState: { preserved: true },
      token: "raw-token",
    });

    expect(sanitized).toEqual({
      path: "/visit/42?lang=en#room",
      state: { preserved: true, visitAccessToken: "raw-token" },
    });
    expect(sanitized.path).not.toContain("raw-token");
  });

  it("restores the source token from the current history entry after refresh", () => {
    expect(
      readVisitRoomAccessToken({
        search: "?lang=en",
        historyState: { visitAccessToken: "raw-token" },
      })
    ).toBe("raw-token");
  });
});
