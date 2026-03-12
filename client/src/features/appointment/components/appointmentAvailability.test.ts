import { describe, expect, it } from "vitest";
import {
  DAYTIME_QUICK_TIME_SLOTS,
  FULL_DAY_QUICK_TIME_SLOTS,
  formatDoctorAvailabilityHint,
  resolveAppointmentAvailabilityConfig,
} from "@/features/appointment/components/appointmentAvailability";

describe("appointmentAvailability", () => {
  it("keeps the daytime doctor window for normal doctors", () => {
    const config = resolveAppointmentAvailabilityConfig(false);

    expect(config.chinaWindowStartMinutes).toBe(9 * 60);
    expect(config.chinaWindowEndMinutes).toBe(18 * 60);
    expect(config.quickTimeSlots).toEqual(DAYTIME_QUICK_TIME_SLOTS);
  });

  it("switches to full-day slots for 24h doctors", () => {
    const config = resolveAppointmentAvailabilityConfig(true);

    expect(config.chinaWindowStartMinutes).toBe(0);
    expect(config.chinaWindowEndMinutes).toBe(23 * 60 + 59);
    expect(config.quickTimeSlots).toEqual(FULL_DAY_QUICK_TIME_SLOTS);
    expect(config.quickTimeSlots).toContain("23:00");
  });

  it("returns a dedicated 24h hint instead of the old range text", () => {
    const hint = formatDoctorAvailabilityHint({
      isTwentyFourHourDoctor: true,
      rangeLabel: "09:00 - 18:00",
      rangeTemplate: "Doctor available: {range} (Local Time)",
      allDayLabel: "Doctor available 24 hours",
    });

    expect(hint).toBe("Doctor available 24 hours");
  });

  it("keeps the range hint for normal doctors", () => {
    const hint = formatDoctorAvailabilityHint({
      isTwentyFourHourDoctor: false,
      rangeLabel: "09:00 - 18:00",
      rangeTemplate: "Doctor available: {range} (Local Time)",
      allDayLabel: "Doctor available 24 hours",
    });

    expect(hint).toBe("Doctor available: 09:00 - 18:00 (Local Time)");
  });
});