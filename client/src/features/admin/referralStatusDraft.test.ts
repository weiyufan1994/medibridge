import { describe, expect, it } from "vitest";
import {
  clearReferralStatusDraft,
  isReferralStatusDraftCompatible,
  readReferralStatusDraft,
  saveReferralStatusDraft,
  type ReferralStatusDraft,
} from "./referralStatusDraft";

const scheduledCompletionDraft: ReferralStatusDraft = {
  fromStatus: "scheduled",
  toStatus: "completed",
  reason: "已与患者确认问诊完成",
};

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("referral status draft", () => {
  it("restores the draft when the order remains in the same status", () => {
    expect(
      isReferralStatusDraftCompatible({
        draft: scheduledCompletionDraft,
        currentStatus: "scheduled",
        allowedTargets: ["completed"],
      })
    ).toBe(true);
  });

  it("rejects stale drafts after the order status changes", () => {
    expect(
      isReferralStatusDraftCompatible({
        draft: scheduledCompletionDraft,
        currentStatus: "completed",
        allowedTargets: [],
      })
    ).toBe(false);
  });

  it("rejects a target that is not available from the current state", () => {
    expect(
      isReferralStatusDraftCompatible({
        draft: scheduledCompletionDraft,
        currentStatus: "scheduled",
        allowedTargets: ["cancelled"],
      })
    ).toBe(false);
  });

  it("stores drafts separately by order and clears only the submitted order", () => {
    const storage = createMemoryStorage();
    const anotherDraft = {
      ...scheduledCompletionDraft,
      reason: "另一笔订单已确认完成",
    };

    saveReferralStatusDraft(storage, 3, scheduledCompletionDraft);
    saveReferralStatusDraft(storage, 4, anotherDraft);

    expect(readReferralStatusDraft(storage, 3)).toEqual(
      scheduledCompletionDraft
    );
    expect(readReferralStatusDraft(storage, 4)).toEqual(anotherDraft);

    clearReferralStatusDraft(storage, 3);

    expect(readReferralStatusDraft(storage, 3)).toBeNull();
    expect(readReferralStatusDraft(storage, 4)).toEqual(anotherDraft);
  });

  it("ignores malformed or unknown status values", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      "medibridge:admin:referral-status-draft:3",
      '{"fromStatus":"future_status","toStatus":"completed","reason":"done"}'
    );

    expect(readReferralStatusDraft(storage, 3)).toBeNull();
  });
});
