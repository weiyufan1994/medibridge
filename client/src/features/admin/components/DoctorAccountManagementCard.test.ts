import { describe, expect, it } from "vitest";
import { getDoctorAccountDoctorLabel } from "@/features/admin/components/DoctorAccountManagementCard";

const tr = (zh: string, en: string) => en;

describe("getDoctorAccountDoctorLabel", () => {
  it("uses the english doctor name when it is present and english-safe", () => {
    expect(
      getDoctorAccountDoctorLabel({
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
      getDoctorAccountDoctorLabel({
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
      getDoctorAccountDoctorLabel({
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
      getDoctorAccountDoctorLabel({
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
