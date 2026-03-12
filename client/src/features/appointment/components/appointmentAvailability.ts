export const DAYTIME_QUICK_TIME_SLOTS = ["09:00", "11:00", "14:00", "16:30", "18:00"];
export const FULL_DAY_QUICK_TIME_SLOTS = ["00:30", "06:00", "09:00", "14:00", "20:00", "23:00"];

export const DEFAULT_CHINA_WINDOW_START_MINUTES = 9 * 60;
export const DEFAULT_CHINA_WINDOW_END_MINUTES = 18 * 60;
export const FULL_DAY_WINDOW_START_MINUTES = 0;
export const FULL_DAY_WINDOW_END_MINUTES = 23 * 60 + 59;

export function resolveAppointmentAvailabilityConfig(isTwentyFourHourDoctor: boolean) {
  if (isTwentyFourHourDoctor) {
    return {
      chinaWindowStartMinutes: FULL_DAY_WINDOW_START_MINUTES,
      chinaWindowEndMinutes: FULL_DAY_WINDOW_END_MINUTES,
      quickTimeSlots: FULL_DAY_QUICK_TIME_SLOTS,
    };
  }

  return {
    chinaWindowStartMinutes: DEFAULT_CHINA_WINDOW_START_MINUTES,
    chinaWindowEndMinutes: DEFAULT_CHINA_WINDOW_END_MINUTES,
    quickTimeSlots: DAYTIME_QUICK_TIME_SLOTS,
  };
}

export function formatDoctorAvailabilityHint(params: {
  isTwentyFourHourDoctor: boolean;
  rangeLabel: string;
  rangeTemplate: string;
  allDayLabel: string;
}) {
  const { allDayLabel, isTwentyFourHourDoctor, rangeLabel, rangeTemplate } = params;

  if (isTwentyFourHourDoctor) {
    return allDayLabel;
  }

  return rangeTemplate.replace("{range}", rangeLabel);
}