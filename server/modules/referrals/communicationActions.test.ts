import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./accessControl", () => ({
  requireUser: vi.fn(),
  resolveActorTypeFromUser: vi.fn(),
}));
vi.mock("./adminReadActions", () => ({
  getAdminOrderDetailAction: vi.fn(),
}));
vi.mock("./notifications", () => ({
  notifyPatientReferralUpdate: vi.fn(),
}));
vi.mock("./repo", () => ({
  insertOperation: vi.fn(),
}));

import { requireUser, resolveActorTypeFromUser } from "./accessControl";
import { getAdminOrderDetailAction } from "./adminReadActions";
import {
  addInternalNoteAction,
  publishPatientProgressUpdateAction,
} from "./communicationActions";
import { notifyPatientReferralUpdate } from "./notifications";
import * as referralRepo from "./repo";

const user = { id: 901, role: "ops" };

describe("referral communication actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(referralRepo.insertOperation).mockReset();
    vi.mocked(notifyPatientReferralUpdate).mockReset();
    vi.mocked(requireUser).mockReturnValue(user as never);
    vi.mocked(resolveActorTypeFromUser).mockReturnValue("ops");
    vi.mocked(getAdminOrderDetailAction).mockResolvedValue({
      order: { id: 101 },
    } as never);
  });

  it("preserves authentication before adding an internal note", async () => {
    vi.mocked(requireUser).mockImplementationOnce(() => {
      throw Object.assign(new Error("Please sign in to continue."), {
        code: "UNAUTHORIZED",
      });
    });

    await expect(
      addInternalNoteAction(null, { orderId: 101, note: "Private note" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(referralRepo.insertOperation).not.toHaveBeenCalled();
  });

  it("records an internal-only note and returns current admin detail", async () => {
    await expect(
      addInternalNoteAction(user as never, {
        orderId: 101,
        note: "Confirm hospital documents",
      })
    ).resolves.toEqual({ order: { id: 101 } });

    expect(referralRepo.insertOperation).toHaveBeenCalledWith({
      orderId: 101,
      operatorType: "ops",
      operatorId: 901,
      actionType: "internal_note",
      actionPayload: { note: "Confirm hospital documents" },
    });
    expect(notifyPatientReferralUpdate).not.toHaveBeenCalled();
    expect(getAdminOrderDetailAction).toHaveBeenCalledWith(user, 101);
  });

  it("does not return stale detail when an internal note write fails", async () => {
    vi.mocked(referralRepo.insertOperation).mockRejectedValue(
      new Error("database unavailable")
    );

    await expect(
      addInternalNoteAction(user as never, {
        orderId: 101,
        note: "Private note",
      })
    ).rejects.toThrow("database unavailable");
    expect(getAdminOrderDetailAction).not.toHaveBeenCalled();
  });

  it("audits and publishes a patient-visible progress update", async () => {
    await expect(
      publishPatientProgressUpdateAction(user as never, {
        orderId: 101,
        detail: "Hospital documents were submitted.",
      })
    ).resolves.toEqual({ order: { id: 101 } });

    expect(referralRepo.insertOperation).toHaveBeenCalledWith({
      orderId: 101,
      operatorType: "ops",
      operatorId: 901,
      actionType: "patient_notification",
      actionPayload: { detail: "Hospital documents were submitted." },
    });
    expect(notifyPatientReferralUpdate).toHaveBeenCalledWith({
      orderId: 101,
      event: "patient_progress_update",
      detail: "Hospital documents were submitted.",
    });
    expect(getAdminOrderDetailAction).toHaveBeenCalledWith(user, 101);
  });

  it("does not notify when the patient-visible audit write fails", async () => {
    vi.mocked(referralRepo.insertOperation).mockRejectedValue(
      new Error("database unavailable")
    );

    await expect(
      publishPatientProgressUpdateAction(user as never, {
        orderId: 101,
        detail: "Progress update",
      })
    ).rejects.toThrow("database unavailable");

    expect(notifyPatientReferralUpdate).not.toHaveBeenCalled();
    expect(getAdminOrderDetailAction).not.toHaveBeenCalled();
  });

  it("does not return stale detail when notification delivery fails", async () => {
    vi.mocked(notifyPatientReferralUpdate).mockRejectedValue(
      new Error("notification unavailable")
    );

    await expect(
      publishPatientProgressUpdateAction(user as never, {
        orderId: 101,
        detail: "Progress update",
      })
    ).rejects.toThrow("notification unavailable");

    expect(referralRepo.insertOperation).toHaveBeenCalledTimes(1);
    expect(getAdminOrderDetailAction).not.toHaveBeenCalled();
  });
});
