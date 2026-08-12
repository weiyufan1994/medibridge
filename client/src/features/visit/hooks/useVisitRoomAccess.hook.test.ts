import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  replaceState: vi.fn(),
  useEffect: vi.fn(),
  useMemo: vi.fn(),
  useRoute: vi.fn(),
}));

vi.mock("react", () => ({
  useEffect: mocks.useEffect,
  useMemo: mocks.useMemo,
}));

vi.mock("wouter", () => ({
  useRoute: mocks.useRoute,
}));

import { useVisitRoomAccess } from "./useVisitRoomAccess";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.effects.length = 0;
  mocks.useEffect.mockImplementation(effect => {
    mocks.effects.push(effect);
  });
  mocks.useMemo.mockImplementation(factory => factory());
  mocks.useRoute.mockReturnValue([true, { id: "42" }]);
  vi.stubGlobal("document", { title: "Visit" });
  vi.stubGlobal("window", {
    location: {
      href: "https://medibridge.test/visit/42?lang=en&t=legacy-token-123456#room",
      search: "?lang=en&t=legacy-token-123456",
    },
    history: {
      state: { preserved: true },
      replaceState: mocks.replaceState,
    },
  });
});

describe("useVisitRoomAccess", () => {
  it("provides a valid legacy access input and sanitizes the visible URL", () => {
    const result = useVisitRoomAccess("en");

    expect(result).toEqual({
      appointmentId: 42,
      token: "legacy-token-123456",
      validInput: true,
      accessInput: {
        appointmentId: 42,
        token: "legacy-token-123456",
        lang: "en",
      },
    });

    mocks.effects[0]();
    expect(mocks.replaceState).toHaveBeenCalledWith(
      {
        preserved: true,
        visitAccessToken: "legacy-token-123456",
      },
      "Visit",
      "/visit/42?lang=en#room"
    );
  });

  it("fails closed without a valid appointment and source token", () => {
    mocks.useRoute.mockReturnValue([true, { id: "invalid" }]);
    vi.stubGlobal("window", {
      location: {
        href: "https://medibridge.test/visit/invalid",
        search: "",
      },
      history: { state: null, replaceState: mocks.replaceState },
    });

    const result = useVisitRoomAccess("zh");

    expect(result.validInput).toBe(false);
    expect(result.accessInput).toEqual({
      appointmentId: 1,
      token: "invalid-token-000",
      lang: "zh",
    });
    mocks.effects[0]();
    expect(mocks.replaceState).not.toHaveBeenCalled();
  });
});
