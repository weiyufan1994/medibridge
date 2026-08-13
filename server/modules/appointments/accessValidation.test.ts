import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../../_core/context";
import type { RequestMetadata } from "@shared/requestMetadata";

vi.mock("./repo", () => ({
  getAppointmentById: vi.fn(),
  updateAppointmentById: vi.fn(),
}));

vi.mock("./tokenValidation", () => ({
  validateAppointmentAccessToken: vi.fn(),
}));

import * as appointmentsRepo from "./repo";
import { validateAppointmentAccessToken } from "./tokenValidation";
import {
  assertAppointmentBelongsToCurrentUser,
  getAppointmentByIdOrThrow,
  getSessionEmailFromContext,
  validateAppointmentToken,
} from "./accessValidation";

const touchedAt = new Date("2026-08-13T09:30:00.000Z");

function createContext(
  headers: Record<string, string | string[] | undefined> = {}
): TrpcContext {
  return {
    req: { headers },
  } as never;
}

function createAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 41,
    userId: 9,
    email: "patient@example.com",
    lastAccessAt: null,
    doctorLastAccessAt: null,
    ...overrides,
  } as never;
}

const requestMetadata: RequestMetadata = {
  clientIp: "198.51.100.8",
  forwardedHost: null,
  forwardedProto: null,
  host: "medibridge.test",
  protocol: "https",
  requestId: "request-41",
  userAgent: "Access-Validation-Test/1.0",
};

describe("appointment access validation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(touchedAt);
    vi.mocked(appointmentsRepo.updateAppointmentById).mockResolvedValue(
      undefined as never
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("session email resolution", () => {
    it("normalizes the explicit session header before cookie fallbacks", () => {
      const context = createContext({
        "x-session-email": "  HEADER@Example.COM ",
        cookie: "sessionEmail=cookie%40example.com",
      });

      expect(getSessionEmailFromContext(context)).toBe("header@example.com");
    });

    it.each([
      ["sessionEmail", "primary@example.com"],
      ["session-email", "hyphen@example.com"],
      ["email", "legacy@example.com"],
    ])("reads the %s cookie fallback", (cookieName, expected) => {
      const context = createContext({
        cookie: `${cookieName}=${encodeURIComponent(expected.toUpperCase())}`,
      });

      expect(getSessionEmailFromContext(context)).toBe(expected);
    });

    it("ignores a multi-value session header and uses the cookie", () => {
      const context = createContext({
        "x-session-email": ["first@example.com", "second@example.com"],
        cookie: "sessionEmail=cookie%40example.com",
      });

      expect(getSessionEmailFromContext(context)).toBe("cookie@example.com");
    });

    it.each([
      ["missing", {}],
      ["blank", { "x-session-email": "   " }],
    ])("returns null for a %s identity", (_name, headers) => {
      expect(getSessionEmailFromContext(createContext(headers))).toBeNull();
    });
  });

  describe("appointment lookup and ownership", () => {
    it("returns the requested appointment", async () => {
      const appointment = createAppointment();
      vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
        appointment
      );

      await expect(getAppointmentByIdOrThrow(41)).resolves.toBe(appointment);
      expect(appointmentsRepo.getAppointmentById).toHaveBeenCalledWith(41);
    });

    it("returns NOT_FOUND when the appointment does not exist", async () => {
      vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
        undefined
      );

      await expect(getAppointmentByIdOrThrow(404)).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Appointment not found",
      });
    });

    it("accepts ownership by the bound user id", () => {
      expect(() =>
        assertAppointmentBelongsToCurrentUser({
          appointment: createAppointment(),
          userId: 9,
          userEmail: "other@example.com",
        })
      ).not.toThrow();
    });

    it("accepts ownership by a normalized appointment email", () => {
      expect(() =>
        assertAppointmentBelongsToCurrentUser({
          appointment: createAppointment({
            userId: null,
            email: "  PATIENT@Example.COM ",
          }),
          userId: 9,
          userEmail: "patient@example.com",
        })
      ).not.toThrow();
    });

    it("rejects a user who matches neither ownership identity", () => {
      expect(() =>
        assertAppointmentBelongsToCurrentUser({
          appointment: createAppointment({ userId: null }),
          userId: 10,
          userEmail: "other@example.com",
        })
      ).toThrowError(
        expect.objectContaining({
          code: "FORBIDDEN",
          message: "You are not allowed to access this appointment",
        })
      );
    });
  });

  describe("token access tracking", () => {
    it("records patient access with the default room action", async () => {
      const appointment = createAppointment();
      vi.mocked(validateAppointmentAccessToken).mockResolvedValue({
        role: "patient",
        appointment,
      } as never);

      await expect(
        validateAppointmentToken(41, "patient-token")
      ).resolves.toEqual({
        role: "patient",
        appointment: { ...appointment, lastAccessAt: touchedAt },
      });

      expect(validateAppointmentAccessToken).toHaveBeenCalledWith({
        token: "patient-token",
        action: "join_room",
        expectedAppointmentId: 41,
        requestMetadata: undefined,
      });
      expect(appointmentsRepo.updateAppointmentById).toHaveBeenCalledWith(41, {
        lastAccessAt: touchedAt,
      });
    });

    it("records doctor access with the requested action and metadata", async () => {
      const appointment = createAppointment();
      vi.mocked(validateAppointmentAccessToken).mockResolvedValue({
        role: "doctor",
        appointment,
      } as never);

      await expect(
        validateAppointmentToken(
          41,
          "doctor-token",
          "send_message",
          requestMetadata
        )
      ).resolves.toEqual({
        role: "doctor",
        appointment: { ...appointment, doctorLastAccessAt: touchedAt },
      });

      expect(validateAppointmentAccessToken).toHaveBeenCalledWith({
        token: "doctor-token",
        action: "send_message",
        expectedAppointmentId: 41,
        requestMetadata,
      });
      expect(appointmentsRepo.updateAppointmentById).toHaveBeenCalledWith(41, {
        doctorLastAccessAt: touchedAt,
      });
    });

    it("does not write access time when token validation fails", async () => {
      vi.mocked(validateAppointmentAccessToken).mockRejectedValue(
        new Error("token rejected")
      );

      await expect(
        validateAppointmentToken(41, "invalid-token")
      ).rejects.toThrow("token rejected");

      expect(appointmentsRepo.updateAppointmentById).not.toHaveBeenCalled();
    });

    it("propagates access-time persistence failure", async () => {
      vi.mocked(validateAppointmentAccessToken).mockResolvedValue({
        role: "patient",
        appointment: createAppointment(),
      } as never);
      vi.mocked(appointmentsRepo.updateAppointmentById).mockRejectedValue(
        new Error("write failed")
      );

      await expect(
        validateAppointmentToken(41, "patient-token")
      ).rejects.toThrow("write failed");
    });
  });
});
