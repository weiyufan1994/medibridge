import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCachedPatientAccessToken,
  getCachedPatientAccessToken,
  setCachedPatientAccessToken,
} from "./tokenCache";

const baseNow = new Date("2026-08-13T12:00:00.000Z");
const appointmentIds = [7001, 7002, 7003];

describe("appointment patient access token cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    for (const appointmentId of appointmentIds) {
      clearCachedPatientAccessToken(appointmentId);
    }
  });

  afterEach(() => {
    for (const appointmentId of appointmentIds) {
      clearCachedPatientAccessToken(appointmentId);
    }
    vi.useRealTimers();
  });

  it("returns null when an appointment has no cached token", () => {
    expect(getCachedPatientAccessToken(7001)).toBeNull();
  });

  it("returns an unexpired token with its original expiry", () => {
    const expiresAt = new Date(baseNow.getTime() + 60_000);
    setCachedPatientAccessToken(7001, "patient-token-1", expiresAt);

    expect(getCachedPatientAccessToken(7001)).toEqual({
      token: "patient-token-1",
      expiresAt,
    });
  });

  it("expires and evicts a token at its exact expiry boundary", () => {
    const expiresAt = new Date(baseNow.getTime() + 60_000);
    setCachedPatientAccessToken(7001, "patient-token-1", expiresAt);

    vi.setSystemTime(expiresAt);

    expect(getCachedPatientAccessToken(7001)).toBeNull();
    expect(getCachedPatientAccessToken(7001)).toBeNull();
  });

  it("isolates replacement and clearing by appointment", () => {
    const expiresAt = new Date(baseNow.getTime() + 60_000);
    setCachedPatientAccessToken(7001, "old-token", expiresAt);
    setCachedPatientAccessToken(7002, "other-token", expiresAt);
    setCachedPatientAccessToken(7001, "new-token", expiresAt);

    clearCachedPatientAccessToken(7001);

    expect(getCachedPatientAccessToken(7001)).toBeNull();
    expect(getCachedPatientAccessToken(7002)).toEqual({
      token: "other-token",
      expiresAt,
    });
  });
});
