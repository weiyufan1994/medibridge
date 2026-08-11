import { describe, expect, it } from "vitest";
import { getSchedulingDoctorLabel } from "@/features/admin/components/SchedulingManagementCard";
import { formatSchedulingStatus } from "@/features/admin/schedulingPresentation";

const tr = (zh: string, en: string) => en;

describe("getSchedulingDoctorLabel", () => {
  it("uses the english doctor name when it is present and english-safe", () => {
    expect(
      getSchedulingDoctorLabel({
        lang: "en",
        doctorId: 12,
        doctor: {
          id: 12,
          name: { zh: "张医生", en: "Dr. Zhang" },
        },
        tr,
      })
    ).toBe("Dr. Zhang (#12)");
  });

  it("uses the explicit english fallback instead of chinese when english is missing or unsafe", () => {
    expect(
      getSchedulingDoctorLabel({
        lang: "en",
        doctorId: 12,
        doctor: {
          id: 12,
          name: { zh: "张医生", en: "" },
        },
        tr,
      })
    ).toBe("Doctor #12 (#12)");

    expect(
      getSchedulingDoctorLabel({
        lang: "en",
        doctorId: 12,
        doctor: {
          id: 12,
          name: { zh: "张医生", en: "张医生" },
        },
        tr,
      })
    ).toBe("Doctor #12 (#12)");
  });

  it("keeps chinese display unchanged in zh mode", () => {
    expect(
      getSchedulingDoctorLabel({
        lang: "zh",
        doctorId: 12,
        doctor: {
          id: 12,
          name: { zh: "张医生", en: "Dr. Zhang" },
        },
        tr,
      })
    ).toBe("张医生 (#12)");
  });
});

describe("formatSchedulingStatus", () => {
  it("localizes known slot statuses", () => {
    expect(formatSchedulingStatus("open", tr)).toBe("Open");
    expect(formatSchedulingStatus("blocked", tr)).toBe("Blocked");
  });

  it("preserves unknown statuses", () => {
    expect(formatSchedulingStatus("custom", tr)).toBe("custom");
  });
});
