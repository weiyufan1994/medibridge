import { describe, expect, it } from "vitest";
import { getDashboardAppointmentCopy } from "@/features/dashboard";
import {
  canEnterMyAppointmentRoomNow,
  extractMyAppointmentTokenFromJoinUrl,
  getMyAppointmentHint,
  getMyAppointmentSections,
  getMyAppointmentStatusBadgeClass,
  getMyAppointmentStatusLabel,
  getMyAppointmentTypeLabel,
  getMyAppointmentUpcomingActionLabel,
  isMyAppointmentScheduledInFuture,
  mapMyAppointmentActionErrorMessage,
  parseMyAppointmentDate,
  sortMyAppointmentsByScheduledAtDesc,
  type MyAppointmentItem,
} from "./myAppointmentsPresentation";

const copy = getDashboardAppointmentCopy("en");
const now = new Date("2026-08-11T10:00:00.000Z");

function appointment(
  overrides: Partial<MyAppointmentItem> = {}
): MyAppointmentItem {
  return {
    id: 1,
    doctorId: 7,
    appointmentType: "online_chat",
    scheduledAt: "2026-08-11T09:00:00.000Z",
    status: "paid",
    paymentStatus: "paid",
    createdAt: "2026-08-10T09:00:00.000Z",
    ...overrides,
  };
}

describe("my appointments presentation", () => {
  it("maps every appointment type without changing labels", () => {
    expect(getMyAppointmentTypeLabel("online_chat", copy)).toBe(
      copy.typeOnline
    );
    expect(getMyAppointmentTypeLabel("video_call", copy)).toBe(copy.typeVideo);
    expect(getMyAppointmentTypeLabel("in_person", copy)).toBe(
      copy.typeInPerson
    );
  });

  it("maps appointment statuses and preserves the scheduled-future label", () => {
    expect(
      getMyAppointmentStatusLabel(
        appointment({
          status: "paid",
          scheduledAt: "2026-08-11T11:00:00.000Z",
        }),
        copy,
        now
      )
    ).toBe(copy.statusNotStarted);
    expect(
      getMyAppointmentStatusLabel(
        appointment({
          status: "active",
          scheduledAt: "2026-08-11T11:00:00.000Z",
        }),
        copy,
        now
      )
    ).toBe(copy.statusNotStarted);

    const expected = {
      draft: copy.statusDraft,
      pending_payment: copy.statusPendingPayment,
      paid: copy.statusPaid,
      active: copy.statusActive,
      ended: copy.statusEnded,
      completed: copy.statusCompleted,
      expired: copy.statusExpired,
      refunded: copy.statusRefunded,
      canceled: copy.statusCanceled,
    } as const;
    for (const [status, label] of Object.entries(expected)) {
      expect(
        getMyAppointmentStatusLabel(
          appointment({ status: status as MyAppointmentItem["status"] }),
          copy,
          now
        )
      ).toBe(label);
    }
  });

  it("keeps hint and room-entry time boundaries explicit", () => {
    expect(
      getMyAppointmentHint(
        appointment({ status: "pending_payment" }),
        copy,
        now
      )
    ).toBe(copy.hintPendingPayment);
    expect(
      getMyAppointmentHint(
        appointment({
          status: "paid",
          scheduledAt: "2026-08-11T11:00:00.000Z",
        }),
        copy,
        now
      )
    ).toBe(copy.hintNotStarted);
    expect(getMyAppointmentHint(appointment(), copy, now)).toBe(copy.hintPaid);
    expect(
      getMyAppointmentHint(
        appointment({
          status: "active",
          scheduledAt: "2026-08-11T11:00:00.000Z",
        }),
        copy,
        now
      )
    ).toBe(copy.hintNotStarted);
    expect(
      getMyAppointmentHint(appointment({ status: "active" }), copy, now)
    ).toBe(copy.hintActive);
    expect(
      getMyAppointmentHint(appointment({ status: "ended" }), copy, now)
    ).toBe(copy.hintEnded);
    expect(
      getMyAppointmentHint(appointment({ status: "completed" }), copy, now)
    ).toBe(copy.hintEnded);
    expect(
      getMyAppointmentHint(appointment({ status: "canceled" }), copy, now)
    ).toBe(copy.hintInactive);

    const futurePaid = appointment({
      scheduledAt: "2026-08-11T11:00:00.000Z",
    });
    expect(isMyAppointmentScheduledInFuture(futurePaid, now)).toBe(true);
    expect(canEnterMyAppointmentRoomNow(futurePaid, now)).toBe(false);
    expect(
      canEnterMyAppointmentRoomNow(
        appointment({ status: "ended", scheduledAt: futurePaid.scheduledAt }),
        now
      )
    ).toBe(true);
    expect(canEnterMyAppointmentRoomNow(appointment(), now)).toBe(true);
  });

  it("preserves status badge and action presentation", () => {
    expect(
      getMyAppointmentStatusBadgeClass(
        "upcoming",
        appointment({ scheduledAt: "2026-08-11T11:00:00.000Z" }),
        now
      )
    ).toContain("sky-50");
    expect(
      getMyAppointmentStatusBadgeClass("past", appointment(), now)
    ).toContain("teal-50");
    expect(
      getMyAppointmentStatusBadgeClass(
        "upcoming",
        appointment({ status: "draft" }),
        now
      )
    ).toContain("teal-50");
    expect(
      getMyAppointmentStatusBadgeClass(
        "past",
        appointment({ status: "completed" }),
        now
      )
    ).toContain("emerald-100");
    expect(
      getMyAppointmentStatusBadgeClass(
        "past",
        appointment({ status: "canceled" }),
        now
      )
    ).toContain("slate-100");

    expect(
      getMyAppointmentUpcomingActionLabel(
        appointment({ status: "pending_payment" }),
        copy
      )
    ).toBe(copy.payNow);
    expect(
      getMyAppointmentUpcomingActionLabel(
        appointment({ status: "draft" }),
        copy
      )
    ).toBe(copy.payNow);
    expect(getMyAppointmentUpcomingActionLabel(appointment(), copy)).toBe(
      copy.enterVisitRoom
    );
  });

  it("sorts and partitions the combined appointment response", () => {
    const paid = appointment({
      id: 2,
      scheduledAt: "2026-08-13T10:00:00.000Z",
    });
    const draft = appointment({
      id: 3,
      status: "draft",
      scheduledAt: "2026-08-13T10:00:00.000Z",
    });
    const ended = appointment({
      id: 4,
      status: "ended",
      scheduledAt: "2026-08-12T10:00:00.000Z",
    });
    const completed = appointment({
      id: 5,
      status: "completed",
      scheduledAt: null,
    });

    expect(sortMyAppointmentsByScheduledAtDesc([paid, draft, ended])).toEqual([
      draft,
      paid,
      ended,
    ]);
    expect(
      getMyAppointmentSections({
        upcoming: [paid],
        completed: [completed],
        past: [draft, ended],
      })
    ).toEqual({
      upcomingItems: [draft, paid],
      pastVisitItems: [ended, completed],
    });
  });

  it("normalizes dates, action errors, and join tokens safely", () => {
    const date = new Date("2026-08-11T10:00:00.000Z");
    expect(parseMyAppointmentDate(date)).toBe(date);
    expect(parseMyAppointmentDate("invalid")).toBeNull();
    expect(parseMyAppointmentDate(null)).toBeNull();
    expect(
      isMyAppointmentScheduledInFuture(
        appointment({ scheduledAt: "invalid" }),
        now
      )
    ).toBe(false);

    expect(
      mapMyAppointmentActionErrorMessage(
        new Error("APPOINTMENT_NOT_STARTED"),
        copy
      )
    ).toBe(copy.hintNotStarted);
    expect(
      mapMyAppointmentActionErrorMessage(
        new Error("APPOINTMENT_NOT_ALLOWED"),
        copy
      )
    ).toBe(copy.hintInactive);
    expect(mapMyAppointmentActionErrorMessage(new Error("custom"), copy)).toBe(
      "custom"
    );
    expect(mapMyAppointmentActionErrorMessage(null, copy)).toBe(
      copy.actionFailed
    );

    expect(
      extractMyAppointmentTokenFromJoinUrl(
        "/visit/1?t=patient-token",
        "https://example.com"
      )
    ).toBe("patient-token");
    expect(
      extractMyAppointmentTokenFromJoinUrl(
        "/visit/1?t=%20%20",
        "https://example.com"
      )
    ).toBe("");
    expect(
      extractMyAppointmentTokenFromJoinUrl("/visit/1", "not-an-origin")
    ).toBe("");
    expect(extractMyAppointmentTokenFromJoinUrl("/visit/1", null)).toBe("");
  });
});
