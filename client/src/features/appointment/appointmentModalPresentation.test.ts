import { describe, expect, it } from "vitest";
import {
  formatAppointmentDateInput,
  formatAppointmentSlotRange,
} from "./appointmentModalPresentation";

describe("appointment modal presentation", () => {
  it("formats a local calendar date for the date input", () => {
    expect(formatAppointmentDateInput(new Date(2026, 0, 7, 23, 30))).toBe(
      "2026-01-07"
    );
  });

  it("formats both ends of a slot using the selected locale", () => {
    const slot = {
      startAt: new Date(2026, 0, 7, 9, 5),
      endAt: new Date(2026, 0, 7, 9, 35),
    };

    expect(formatAppointmentSlotRange(slot, "en")).toContain("09:05");
    expect(formatAppointmentSlotRange(slot, "zh")).toBe("09:05 - 09:35");
  });
});
