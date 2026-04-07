import { describe, expect, it } from "vitest";
import {
  getOverviewDoctorPresentation,
  getOverviewTriageSummaryDisplay,
} from "@/features/admin/components/appointment-detail/OverviewSection";

const trEn = (_zh: string, en: string) => en;
const trZh = (zh: string, _en: string) => zh;

describe("getOverviewDoctorPresentation", () => {
  it("uses english-safe doctor and department labels when available", () => {
    expect(
      getOverviewDoctorPresentation({
        lang: "en",
        doctor: {
          id: 7,
          name: { zh: "张医生", en: "Dr. Zhang" },
          hospitalName: { zh: "仁济医院", en: "Renji Hospital" },
          departmentName: { zh: "心内科", en: "Cardiology" },
        },
        tr: trEn,
      })
    ).toEqual({
      doctorName: "Dr. Zhang",
      departmentName: "Cardiology",
    });
  });

  it("uses explicit english fallbacks instead of chinese labels when english is missing or unsafe", () => {
    expect(
      getOverviewDoctorPresentation({
        lang: "en",
        doctor: {
          id: 7,
          name: { zh: "张医生", en: "" },
          hospitalName: { zh: "仁济医院", en: "Renji Hospital" },
          departmentName: { zh: "心内科", en: "心内科" },
        },
        tr: trEn,
      })
    ).toEqual({
      doctorName: "Unknown",
      departmentName: "Unknown department",
    });
  });

  it("keeps zh labels unchanged", () => {
    expect(
      getOverviewDoctorPresentation({
        lang: "zh",
        doctor: {
          id: 7,
          name: { zh: "张医生", en: "Dr. Zhang" },
          hospitalName: { zh: "仁济医院", en: "Renji Hospital" },
          departmentName: { zh: "心内科", en: "Cardiology" },
        },
        tr: trZh,
      })
    ).toEqual({
      doctorName: "张医生",
      departmentName: "心内科",
    });
  });
});

describe("getOverviewTriageSummaryDisplay", () => {
  it("keeps english-safe summary text in english mode", () => {
    expect(
      getOverviewTriageSummaryDisplay({
        lang: "en",
        summary: "Follow up in one week.",
      })
    ).toBe("Follow up in one week.");
  });

  it("suppresses chinese summary text in english mode", () => {
    expect(
      getOverviewTriageSummaryDisplay({
        lang: "en",
        summary: "建议一周后复诊。",
      })
    ).toBe("-");
  });

  it("keeps zh summary text unchanged", () => {
    expect(
      getOverviewTriageSummaryDisplay({
        lang: "zh",
        summary: "建议一周后复诊。",
      })
    ).toBe("建议一周后复诊。");
  });
});
