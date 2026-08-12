import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  getTriageRecommendationsAction: vi.fn(),
  getSelectionContextAction: vi.fn(),
  createOrderDraftAction: vi.fn(),
  createPaymentSessionAction: vi.fn(),
  confirmReturnedPaymentSessionAction: vi.fn(),
  confirmMockPaymentAction: vi.fn(),
  listMineOrdersAction: vi.fn(),
  getOrderDetailAction: vi.fn(),
  listOrdersForAdminAction: vi.fn(),
  getAdminOrderDetailAction: vi.fn(),
  claimOrderAction: vi.fn(),
  assignOrderAction: vi.fn(),
  assignOrderContactAction: vi.fn(),
  updateOrderStatusAction: vi.fn(),
  addInternalNoteAction: vi.fn(),
  publishPatientProgressUpdateAction: vi.fn(),
  recordContactAttemptAction: vi.fn(),
  recordBookingResultAction: vi.fn(),
  beginTimeCoordinationAction: vi.fn(),
  setConsultationTimeAction: vi.fn(),
  initiateRefundAction: vi.fn(),
  reviewRefundAction: vi.fn(),
  listReferralHospitalsForAdminAction: vi.fn(),
  listReferralDepartmentsForAdminAction: vi.fn(),
  listReferralContactsForAdminAction: vi.fn(),
  listAssignableAgentsAction: vi.fn(),
  upsertHospitalAction: vi.fn(),
  upsertContactAction: vi.fn(),
  updateHospitalActiveAction: vi.fn(),
  updateContactActiveAction: vi.fn(),
}));

vi.mock("./modules/referrals/routerApi", async () => {
  const { z } = await import("zod");
  const schema = z.any();
  return {
    referralActions: actions,
    referralSchemas: new Proxy(
      {},
      {
        get: () => schema,
      }
    ),
  };
});

import { referralsRouter } from "./routers/referrals";

const patient = { id: 11, email: "patient@example.com", role: "free" };
const ops = { id: 22, email: "ops@example.com", role: "ops" };
const admin = { id: 33, email: "admin@example.com", role: "admin" };
const requestMetadata = {
  requestId: "referral-request-1",
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
};

function caller(user: typeof patient | null) {
  return referralsRouter.createCaller({
    user,
    requestMetadata,
    req: { headers: {} },
    res: {},
  } as never);
}

describe("referrals router delegation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const action of Object.values(actions)) {
      action.mockResolvedValue({ ok: true });
    }
  });

  it("keeps returned-payment confirmation public and delegates a normalized input", async () => {
    await caller(null).confirmReturnedPaymentSession({
      paymentSessionId: " session-123 ",
    });
    expect(actions.confirmReturnedPaymentSessionAction).toHaveBeenCalledWith({
      paymentSessionId: " session-123 ",
    });
  });

  it("keeps patient procedures protected", async () => {
    await expect(
      caller(null).getTriageRecommendations({ triageSessionId: 1 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(actions.getTriageRecommendationsAction).not.toHaveBeenCalled();
  });

  it("delegates every patient procedure with user and input context", async () => {
    const api = caller(patient);
    const input = { marker: "patient-input" } as never;

    await api.getTriageRecommendations(input);
    await api.getSelectionContext(input);
    await api.createOrderDraft(input);
    await api.createPaymentSession(input);
    await api.confirmMockPayment(input);
    await api.listMine(input);
    await api.getOrderDetail({ orderId: 41 });

    expect(actions.getTriageRecommendationsAction).toHaveBeenCalledWith(
      patient,
      input
    );
    expect(actions.getSelectionContextAction).toHaveBeenCalledWith(
      patient,
      input
    );
    expect(actions.createOrderDraftAction).toHaveBeenCalledWith(patient, input);
    expect(actions.createPaymentSessionAction).toHaveBeenCalledWith({
      user: patient,
      createInput: input,
      requestMetadata,
    });
    expect(actions.confirmMockPaymentAction).toHaveBeenCalledWith(
      patient,
      input
    );
    expect(actions.listMineOrdersAction).toHaveBeenCalledWith(patient, input);
    expect(actions.getOrderDetailAction).toHaveBeenCalledWith(patient, 41);
  });

  it("keeps operations procedures restricted to admin or ops", async () => {
    await expect(caller(patient).listOrders({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(actions.listOrdersForAdminAction).not.toHaveBeenCalled();
  });

  it("delegates all admin-or-ops procedures with their required argument shapes", async () => {
    const api = caller(ops);
    const input = { marker: "ops-input" } as never;

    await api.listOrders(input);
    await api.getAdminOrderDetail({ orderId: 42 });
    await api.claimOrder(input);
    await api.assignOrder(input);
    await api.assignOrderContact(input);
    await api.updateOrderStatus(input);
    await api.addInternalNote(input);
    await api.publishPatientProgressUpdate(input);
    await api.recordContactAttempt(input);
    await api.recordBookingResult(input);
    await api.beginTimeCoordination(input);
    await api.setConsultationTime(input);
    await api.initiateRefund(input);
    await api.reviewRefund(input);
    await api.listHospitalsForAdmin();
    await api.listDepartmentsForAdmin({ hospitalId: 7 });
    await api.listContactsForAdmin(input);
    await api.listAssignableAgents();

    expect(actions.listOrdersForAdminAction).toHaveBeenCalledWith(ops, input);
    expect(actions.getAdminOrderDetailAction).toHaveBeenCalledWith(ops, 42);
    expect(actions.claimOrderAction).toHaveBeenCalledWith(ops, input);
    expect(actions.assignOrderAction).toHaveBeenCalledWith(ops, input);
    expect(actions.assignOrderContactAction).toHaveBeenCalledWith(ops, input);
    expect(actions.updateOrderStatusAction).toHaveBeenCalledWith(ops, input);
    expect(actions.addInternalNoteAction).toHaveBeenCalledWith(ops, input);
    expect(actions.publishPatientProgressUpdateAction).toHaveBeenCalledWith(
      ops,
      input
    );
    expect(actions.recordContactAttemptAction).toHaveBeenCalledWith(ops, input);
    expect(actions.recordBookingResultAction).toHaveBeenCalledWith(ops, input);
    expect(actions.beginTimeCoordinationAction).toHaveBeenCalledWith(
      ops,
      input
    );
    expect(actions.setConsultationTimeAction).toHaveBeenCalledWith(ops, input);
    expect(actions.initiateRefundAction).toHaveBeenCalledWith(ops, input);
    expect(actions.reviewRefundAction).toHaveBeenCalledWith(ops, input);
    expect(actions.listReferralHospitalsForAdminAction).toHaveBeenCalledWith();
    expect(actions.listReferralDepartmentsForAdminAction).toHaveBeenCalledWith(
      7
    );
    expect(actions.listReferralContactsForAdminAction).toHaveBeenCalledWith(
      input
    );
    expect(actions.listAssignableAgentsAction).toHaveBeenCalledWith();
  });

  it("keeps catalog mutations admin-only", async () => {
    await expect(caller(ops).upsertHospital({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(actions.upsertHospitalAction).not.toHaveBeenCalled();
  });

  it("delegates all admin-only catalog mutations", async () => {
    const api = caller(admin);
    const hospital = { marker: "hospital" } as never;
    const contact = { marker: "contact" } as never;

    await api.upsertHospital(hospital);
    await api.upsertContact(contact);
    await api.updateHospitalActive({ hospitalId: 8, isActive: true });
    await api.updateContactActive({ contactId: 9, isActive: false });

    expect(actions.upsertHospitalAction).toHaveBeenCalledWith(hospital);
    expect(actions.upsertContactAction).toHaveBeenCalledWith(contact);
    expect(actions.updateHospitalActiveAction).toHaveBeenCalledWith({
      hospitalId: 8,
      isActive: true,
    });
    expect(actions.updateContactActiveAction).toHaveBeenCalledWith({
      contactId: 9,
      isActive: false,
    });
  });
});
