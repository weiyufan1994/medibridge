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
vi.mock("./orderTransition", () => ({
  changeOrderStatus: vi.fn(),
}));
vi.mock("./repo", () => ({
  getReferralOrderById: vi.fn(),
  insertOperation: vi.fn(),
  updateReferralOrderById: vi.fn(),
}));

import { requireUser, resolveActorTypeFromUser } from "./accessControl";
import { getAdminOrderDetailAction } from "./adminReadActions";
import { notifyPatientReferralUpdate } from "./notifications";
import { changeOrderStatus } from "./orderTransition";
import * as referralRepo from "./repo";
import {
  beginTimeCoordinationAction,
  setConsultationTimeAction,
} from "./schedulingActions";
import { REFERRAL_INVALID_TRANSITION_ERROR } from "./stateMachine";

const user = { id: 901, role: "ops" };
const coordinationOrder = {
  id: 101,
  status: "booking_in_progress",
  paymentStatus: "paid",
};
const consultationTime = new Date("2026-08-20T09:30:00.000Z");
const scheduleInput = {
  orderId: 101,
  consultationTime,
  timeZone: "Asia/Shanghai",
  providerName: "Dr. Chen",
  platform: "Hospital Video",
  joinUrl: "https://hospital.example/visit/101",
  instructions: "Join ten minutes early.",
};
const arrangementUpdate = {
  consultationTime,
  consultationTimeZone: "Asia/Shanghai",
  consultationProviderName: "Dr. Chen",
  consultationPlatform: "Hospital Video",
  consultationJoinUrl: "https://hospital.example/visit/101",
  consultationInstructions: "Join ten minutes early.",
};

describe("referral scheduling actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(changeOrderStatus).mockReset();
    vi.mocked(referralRepo.updateReferralOrderById).mockReset();
    vi.mocked(requireUser).mockReturnValue(user as never);
    vi.mocked(resolveActorTypeFromUser).mockReturnValue("ops");
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      coordinationOrder as never
    );
    vi.mocked(getAdminOrderDetailAction).mockResolvedValue({
      order: { id: 101 },
    } as never);
  });

  describe("beginTimeCoordinationAction", () => {
    it("preserves authentication before reading the order", async () => {
      vi.mocked(requireUser).mockImplementationOnce(() => {
        throw Object.assign(new Error("Please sign in to continue."), {
          code: "UNAUTHORIZED",
        });
      });

      await expect(
        beginTimeCoordinationAction(null, {
          orderId: 101,
          note: "Start coordination",
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(referralRepo.getReferralOrderById).not.toHaveBeenCalled();
    });

    it("preserves the missing-order failure", async () => {
      vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(null);

      await expect(
        beginTimeCoordinationAction(user as never, {
          orderId: 101,
          note: "Start coordination",
        })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Referral order not found",
      });
    });

    it("requires booking-in-progress state", async () => {
      vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
        ...coordinationOrder,
        status: "assigned",
      } as never);

      await expect(
        beginTimeCoordinationAction(user as never, {
          orderId: 101,
          note: "Start coordination",
        })
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: REFERRAL_INVALID_TRANSITION_ERROR,
      });
      expect(changeOrderStatus).not.toHaveBeenCalled();
    });

    it("starts coordination, audits it, and returns current detail", async () => {
      await expect(
        beginTimeCoordinationAction(user as never, {
          orderId: 101,
          note: "Patient supplied availability",
        })
      ).resolves.toEqual({ order: { id: 101 } });

      expect(changeOrderStatus).toHaveBeenCalledWith({
        orderId: 101,
        toStatus: "time_coordination",
        toPaymentStatus: "paid",
        actorType: "ops",
        actorId: 901,
        reason: "consultation_time_coordination_started",
      });
      expect(referralRepo.insertOperation).toHaveBeenCalledWith({
        orderId: 101,
        operatorType: "ops",
        operatorId: 901,
        actionType: "time_coordination_started",
        actionPayload: { note: "Patient supplied availability" },
      });
      expect(getAdminOrderDetailAction).toHaveBeenCalledWith(user, 101);
    });

    it("does not audit or return stale detail after a transition failure", async () => {
      vi.mocked(changeOrderStatus).mockRejectedValue(
        new Error(REFERRAL_INVALID_TRANSITION_ERROR)
      );

      await expect(
        beginTimeCoordinationAction(user as never, {
          orderId: 101,
          note: "Start coordination",
        })
      ).rejects.toThrow(REFERRAL_INVALID_TRANSITION_ERROR);

      expect(referralRepo.insertOperation).not.toHaveBeenCalled();
      expect(getAdminOrderDetailAction).not.toHaveBeenCalled();
    });
  });

  describe("setConsultationTimeAction", () => {
    it("preserves the missing-order failure", async () => {
      vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(null);

      await expect(
        setConsultationTimeAction(user as never, scheduleInput)
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Referral order not found",
      });
    });

    it.each(["booking_in_progress", "completed"])(
      "rejects scheduling from %s",
      async status => {
        vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
          ...coordinationOrder,
          status,
        } as never);

        await expect(
          setConsultationTimeAction(user as never, scheduleInput)
        ).rejects.toMatchObject({
          code: "PRECONDITION_FAILED",
          message: REFERRAL_INVALID_TRANSITION_ERROR,
        });
        expect(changeOrderStatus).not.toHaveBeenCalled();
        expect(referralRepo.updateReferralOrderById).not.toHaveBeenCalled();
      }
    );

    it("confirms the first consultation time and sends the existing bilingual notice", async () => {
      vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
        ...coordinationOrder,
        status: "time_coordination",
      } as never);

      await expect(
        setConsultationTimeAction(user as never, scheduleInput)
      ).resolves.toEqual({ order: { id: 101 } });

      expect(changeOrderStatus).toHaveBeenCalledWith({
        orderId: 101,
        toStatus: "scheduled",
        toPaymentStatus: "paid",
        actorType: "ops",
        actorId: 901,
        reason: "consultation_time_confirmed",
        update: arrangementUpdate,
      });
      expect(referralRepo.insertOperation).toHaveBeenNthCalledWith(1, {
        orderId: 101,
        operatorType: "ops",
        operatorId: 901,
        actionType: "consultation_time_confirmed",
        actionPayload: {
          consultationTime: "2026-08-20T09:30:00.000Z",
          timeZone: "Asia/Shanghai",
          providerName: "Dr. Chen",
          platform: "Hospital Video",
          joinUrl: "https://hospital.example/visit/101",
          instructions: "Join ten minutes early.",
          note: null,
        },
      });
      expect(referralRepo.insertOperation).toHaveBeenNthCalledWith(2, {
        orderId: 101,
        operatorType: "system",
        actionType: "patient_notification",
        actionPayload: { detail: "Consultation time confirmed." },
      });
      expect(notifyPatientReferralUpdate).toHaveBeenCalledWith({
        orderId: 101,
        event: "consultation_time_confirmed",
        detail: "2026-08-20T09:30:00.000Z",
        detailByLanguage: {
          zh: "线上面诊已安排：2026-08-20T09:30:00.000Z（Asia/Shanghai），平台：Hospital Video。请登录订单页查看加入链接和操作说明。",
          en: "Your online consultation is scheduled for 2026-08-20T09:30:00.000Z (Asia/Shanghai) on Hospital Video. Sign in to the order page for the joining link and instructions.",
        },
      });
    });

    it("updates an existing schedule without repeating the state transition", async () => {
      vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
        ...coordinationOrder,
        status: "scheduled",
      } as never);

      await setConsultationTimeAction(user as never, {
        ...scheduleInput,
        note: "Hospital requested a new time",
      });

      expect(changeOrderStatus).not.toHaveBeenCalled();
      expect(referralRepo.updateReferralOrderById).toHaveBeenCalledWith({
        orderId: 101,
        update: arrangementUpdate,
      });
      expect(referralRepo.insertOperation).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          actionType: "consultation_time_updated",
          actionPayload: expect.objectContaining({
            note: "Hospital requested a new time",
          }),
        })
      );
      expect(notifyPatientReferralUpdate).toHaveBeenCalledTimes(1);
    });

    it("does not notify after a first-schedule transition failure", async () => {
      vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
        ...coordinationOrder,
        status: "time_coordination",
      } as never);
      vi.mocked(changeOrderStatus).mockRejectedValue(
        new Error(REFERRAL_INVALID_TRANSITION_ERROR)
      );

      await expect(
        setConsultationTimeAction(user as never, scheduleInput)
      ).rejects.toThrow(REFERRAL_INVALID_TRANSITION_ERROR);

      expect(referralRepo.insertOperation).not.toHaveBeenCalled();
      expect(notifyPatientReferralUpdate).not.toHaveBeenCalled();
    });

    it("does not notify after an existing-schedule persistence failure", async () => {
      vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
        ...coordinationOrder,
        status: "scheduled",
      } as never);
      vi.mocked(referralRepo.updateReferralOrderById).mockRejectedValue(
        new Error("database unavailable")
      );

      await expect(
        setConsultationTimeAction(user as never, scheduleInput)
      ).rejects.toThrow("database unavailable");

      expect(referralRepo.insertOperation).not.toHaveBeenCalled();
      expect(notifyPatientReferralUpdate).not.toHaveBeenCalled();
    });
  });
});
