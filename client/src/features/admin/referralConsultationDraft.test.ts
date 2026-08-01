import { describe, expect, it } from "vitest";
import {
  areReferralConsultationDraftsEqual,
  clearReferralConsultationDraft,
  getReferralConsultationDraftIssues,
  readReferralConsultationDraft,
  saveReferralConsultationDraft,
  type ReferralConsultationDraft,
} from "./referralConsultationDraft";

const validDraft: ReferralConsultationDraft = {
  consultationTimeInput: "2026-08-24T12:00",
  timeZone: "Asia/Shanghai",
  providerName: "中国医学科学院",
  platform: "Zoom",
  joinUrl: "https://www.abc.com",
  instructions: "点击链接进入会议室",
  note: "",
};

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("referral consultation draft", () => {
  it("accepts a complete arrangement with an HTTPS join link", () => {
    expect(getReferralConsultationDraftIssues(validDraft)).toEqual([]);
  });

  it("explains why a link without the HTTPS scheme cannot be submitted", () => {
    expect(
      getReferralConsultationDraftIssues({
        ...validDraft,
        joinUrl: "www.abc.com",
      })
    ).toContain("join_url_https_required");
  });

  it("reports each missing required field", () => {
    expect(
      getReferralConsultationDraftIssues({
        consultationTimeInput: "",
        timeZone: "",
        providerName: "",
        platform: "",
        joinUrl: "",
        instructions: "",
        note: "",
      })
    ).toEqual([
      "consultation_time_required",
      "time_zone_required",
      "provider_required",
      "platform_required",
      "join_url_required",
      "instructions_required",
    ]);
  });

  it("stores drafts separately for each order and clears only the saved order", () => {
    const storage = createMemoryStorage();
    const anotherDraft = { ...validDraft, platform: "Teams" };

    saveReferralConsultationDraft(storage, 3, validDraft);
    saveReferralConsultationDraft(storage, 4, anotherDraft);

    expect(readReferralConsultationDraft(storage, 3)).toEqual(validDraft);
    expect(readReferralConsultationDraft(storage, 4)).toEqual(anotherDraft);

    clearReferralConsultationDraft(storage, 3);

    expect(readReferralConsultationDraft(storage, 3)).toBeNull();
    expect(readReferralConsultationDraft(storage, 4)).toEqual(anotherDraft);
  });

  it("ignores invalid stored values", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      "medibridge:admin:referral-consultation-draft:3",
      '{"joinUrl":42}'
    );

    expect(readReferralConsultationDraft(storage, 3)).toBeNull();
  });

  it("compares all persisted fields", () => {
    expect(areReferralConsultationDraftsEqual(validDraft, validDraft)).toBe(
      true
    );
    expect(
      areReferralConsultationDraftsEqual(validDraft, {
        ...validDraft,
        note: "患者已确认",
      })
    ).toBe(false);
  });
});
