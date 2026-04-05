import { describe, expect, it } from "vitest";
import { getAppointmentSurfaceText } from "@/features/appointment/presentation";

describe("appointment presentation", () => {
  it("uses explicit english fallbacks instead of leaking chinese source text", () => {
    expect(
      getAppointmentSurfaceText({
        lang: "en",
        value: { zh: "张医生", en: "" },
        fallback: "Doctor #12",
      })
    ).toBe("Doctor #12");

    expect(
      getAppointmentSurfaceText({
        lang: "en",
        value: { zh: "主任医师", en: "主任医师" },
        fallback: "Online chat",
      })
    ).toBe("Online chat");
  });

  it("keeps chinese display text intact in zh mode", () => {
    expect(
      getAppointmentSurfaceText({
        lang: "zh",
        value: { zh: "张医生", en: "Dr. Zhang" },
        fallback: "医生 #12",
      })
    ).toBe("张医生");
  });
});
