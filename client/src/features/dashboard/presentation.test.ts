import { describe, expect, it } from "vitest";
import { parseDashboardSectionFromSearch } from "./presentation";

describe("parseDashboardSectionFromSearch", () => {
  it("defaults to account when no supported section is provided", () => {
    expect(parseDashboardSectionFromSearch("")).toBe("account");
    expect(parseDashboardSectionFromSearch("?section=unknown")).toBe("account");
    expect(parseDashboardSectionFromSearch(null)).toBe("account");
  });

  it("returns the appointments section for referral order navigation", () => {
    expect(parseDashboardSectionFromSearch("?section=appointments")).toBe(
      "appointments"
    );
  });

  it("returns the consultations section when requested", () => {
    expect(parseDashboardSectionFromSearch("?section=consultations")).toBe(
      "consultations"
    );
  });
});
