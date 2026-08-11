import { describe, expect, it } from "vitest";
import { buildPrimaryReferralEntryHref } from "./TriageHospitalRoutingCard";

describe("buildPrimaryReferralEntryHref", () => {
  it("preserves the first ranked hospital selection", () => {
    expect(
      buildPrimaryReferralEntryHref({
        triageSessionId: 77,
        hospitals: [
          {
            hospitalName: "First Hospital",
            matchedHospitalId: 11,
          },
        ] as Parameters<typeof buildPrimaryReferralEntryHref>[0]["hospitals"],
      })
    ).toBe(
      "/referrals/select?triageSessionId=77&rankedHospitalIndex=0&hospitalId=11"
    );
  });

  it("falls back to triage when a referral session is unavailable", () => {
    expect(
      buildPrimaryReferralEntryHref({
        triageSessionId: 0,
        hospitals: [
          {
            hospitalName: "First Hospital",
            matchedHospitalId: 11,
          },
        ] as Parameters<typeof buildPrimaryReferralEntryHref>[0]["hospitals"],
      })
    ).toBe("/triage");
    expect(
      buildPrimaryReferralEntryHref({ triageSessionId: 77, hospitals: [] })
    ).toBe("/triage");
  });
});
