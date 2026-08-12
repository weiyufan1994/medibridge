import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  effects: [] as Array<() => void | (() => void)>,
  stateValues: [] as unknown[],
  stateIndex: 0,
  setters: [] as ReturnType<typeof vi.fn>[],
  exchange: { mutateAsync: vi.fn() },
  refresh: { mutateAsync: vi.fn() },
  setTimeout: vi.fn(),
  clearTimeout: vi.fn(),
}));

vi.mock("react", () => ({
  useEffect: mocks.useEffect,
  useRef: mocks.useRef,
  useState: mocks.useState,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    appointments: {
      exchangeVisitChatToken: { useMutation: () => mocks.exchange },
      refreshVisitChatToken: { useMutation: () => mocks.refresh },
    },
  },
}));

import {
  getVisitChatRefreshDelay,
  useVisitChatToken,
} from "./useVisitChatToken";

function renderHook(stateValues: unknown[] = []) {
  mocks.effects.length = 0;
  mocks.setters.length = 0;
  mocks.stateValues = stateValues;
  mocks.stateIndex = 0;
  return useVisitChatToken({
    appointmentId: 42,
    sourceToken: "source-appointment-token",
    enabled: true,
  });
}

function chatTokenState(token: string, expiresAt: Date) {
  return {
    token,
    expiresAt,
    appointmentId: 42,
    sourceToken: "source-appointment-token",
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useState.mockImplementation(initial => {
    const index = mocks.stateIndex++;
    const setter = vi.fn();
    mocks.setters.push(setter);
    return [
      index < mocks.stateValues.length ? mocks.stateValues[index] : initial,
      setter,
    ];
  });
  mocks.useEffect.mockImplementation(effect => {
    mocks.effects.push(effect);
  });
  mocks.useRef.mockImplementation(initial => ({ current: initial }));
  mocks.setTimeout.mockImplementation(() => 7);
  vi.stubGlobal("window", {
    setTimeout: mocks.setTimeout,
    clearTimeout: mocks.clearTimeout,
  });
});

describe("useVisitChatToken", () => {
  it("exchanges the source link before enabling chat", async () => {
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    mocks.exchange.mutateAsync.mockResolvedValue({
      token: "short-lived-chat-token",
      expiresAt,
    });

    const state = renderHook();
    expect(state).toMatchObject({ token: null, error: null, isLoading: true });
    mocks.effects[1]();
    await flushPromises();

    expect(mocks.exchange.mutateAsync).toHaveBeenCalledWith({
      appointmentId: 42,
      token: "source-appointment-token",
    });
    expect(mocks.setters[0]).toHaveBeenCalledWith({
      token: "short-lived-chat-token",
      expiresAt,
      appointmentId: 42,
      sourceToken: "source-appointment-token",
    });
  });

  it("fails closed when the source-link exchange fails", async () => {
    const error = new Error("TOKEN_REVOKED");
    mocks.exchange.mutateAsync.mockRejectedValue(error);
    renderHook();
    mocks.effects[1]();
    await flushPromises();

    expect(mocks.setters[1]).toHaveBeenCalledWith({
      error,
      appointmentId: 42,
      sourceToken: "source-appointment-token",
    });
    expect(mocks.setters[0]).not.toHaveBeenCalledWith(
      expect.objectContaining({ token: expect.any(String) })
    );
  });

  it("refreshes before expiry using only the current visit_chat token", async () => {
    const currentExpiresAt = new Date(Date.now() + 5 * 60_000);
    const nextExpiresAt = new Date(Date.now() + 15 * 60_000);
    mocks.refresh.mutateAsync.mockResolvedValue({
      token: "refreshed-chat-token",
      expiresAt: nextExpiresAt,
    });
    renderHook([chatTokenState("current-chat-token", currentExpiresAt), null]);
    mocks.effects[2]();

    expect(mocks.setTimeout).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Number)
    );
    const refresh = mocks.setTimeout.mock.calls[0][0] as () => void;
    refresh();
    await flushPromises();

    expect(mocks.refresh.mutateAsync).toHaveBeenCalledWith({
      appointmentId: 42,
      token: "current-chat-token",
    });
    expect(mocks.setters[0]).toHaveBeenCalledWith({
      token: "refreshed-chat-token",
      expiresAt: nextExpiresAt,
      appointmentId: 42,
      sourceToken: "source-appointment-token",
    });
  });

  it("clears chat access when refresh fails", async () => {
    const error = new Error("TOKEN_EXPIRED");
    mocks.refresh.mutateAsync.mockRejectedValue(error);
    renderHook([
      chatTokenState("current-chat-token", new Date(Date.now() + 120_000)),
      null,
    ]);
    mocks.effects[2]();
    const refresh = mocks.setTimeout.mock.calls[0][0] as () => void;
    refresh();
    await flushPromises();

    expect(mocks.setters[0]).toHaveBeenCalledWith(null);
    expect(mocks.setters[1]).toHaveBeenCalledWith({
      error,
      appointmentId: 42,
      sourceToken: "source-appointment-token",
    });
  });

  it("does not spin refreshes when the source lifetime has under a minute left", () => {
    const now = Date.now();
    expect(getVisitChatRefreshDelay(new Date(now + 60_000), now)).toBeNull();
    renderHook([
      chatTokenState("near-expiry-token", new Date(now + 30_000)),
      null,
    ]);
    mocks.effects[2]();
    expect(mocks.setTimeout).not.toHaveBeenCalled();
  });

  it("never exposes a chat token issued for a previous appointment", () => {
    const state = renderHook([
      {
        ...chatTokenState(
          "previous-appointment-token",
          new Date(Date.now() + 120_000)
        ),
        appointmentId: 41,
      },
      null,
    ]);

    expect(state).toEqual({ token: null, error: null, isLoading: true });
    expect(mocks.setTimeout).not.toHaveBeenCalled();
  });
});
