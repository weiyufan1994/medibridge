import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_DRAFT_FORM } from "./medicalSummaryModal.helpers";
import type { MedicalSummaryModalCopy } from "./useMedicalSummaryDraftController";

const mocks = vi.hoisted(() => ({
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  stateValues: [] as unknown[],
  stateIndex: 0,
  refIndex: 0,
  stateSetters: [] as ReturnType<typeof vi.fn>[],
  refObjects: [] as Array<{ current: unknown }>,
  effects: [] as Array<() => void | (() => void)>,
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  generateMutation: { mutateAsync: vi.fn() },
  signMutation: { mutateAsync: vi.fn(), isPending: false },
  invalidateGetByToken: vi.fn(),
  invalidateListMyAppointments: vi.fn(),
  invalidateListMine: vi.fn(),
  invalidateRoomMessages: vi.fn(),
}));

vi.mock("react", () => ({
  useCallback: <T>(callback: T) => callback,
  useEffect: mocks.useEffect,
  useRef: mocks.useRef,
  useState: mocks.useState,
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    appointments: {
      generateMedicalSummaryDraft: {
        useMutation: () => mocks.generateMutation,
      },
      signMedicalSummary: { useMutation: () => mocks.signMutation },
    },
    useUtils: () => ({
      appointments: {
        getByToken: { invalidate: mocks.invalidateGetByToken },
        listMyAppointments: {
          invalidate: mocks.invalidateListMyAppointments,
        },
        listMine: { invalidate: mocks.invalidateListMine },
      },
      visit: {
        roomGetMessages: { invalidate: mocks.invalidateRoomMessages },
      },
    }),
  },
}));

import { useMedicalSummaryDraftController } from "./useMedicalSummaryDraftController";

const completeForm = {
  chiefComplaint: "Cough",
  historyOfPresentIllness: "Three days",
  pastMedicalHistory: "None",
  assessmentDiagnosis: "URI",
  planRecommendations: "Rest",
};

const copy: MedicalSummaryModalCopy = {
  title: "Medical summary",
  aiDisclaimer: "AI draft",
  chiefComplaintLabel: "Chief complaint",
  hpiLabel: "HPI",
  pmhLabel: "PMH",
  assessmentLabel: "Assessment",
  planLabel: "Plan",
  cancelText: "Cancel",
  regenerateText: "Regenerate",
  signText: "Sign",
  generatingText: "Generating",
  signingText: "Signing",
  signSuccessText: "Signed",
  draftFailedText: "Draft failed",
  draftTimeoutText: "Draft timed out",
  draftTimeoutHintText: "Try again",
  requiredFieldsText: "All fields required",
  signFailedText: "Sign failed",
};

function renderController(
  stateValues: unknown[] = [],
  options: { open?: boolean } = {}
) {
  mocks.stateValues = stateValues;
  mocks.stateIndex = 0;
  mocks.refIndex = 0;
  mocks.stateSetters.length = 0;
  mocks.refObjects.length = 0;
  mocks.effects.length = 0;
  const onOpenChange = vi.fn();
  const onSigned = vi.fn();
  const controller = useMedicalSummaryDraftController({
    open: options.open ?? false,
    onOpenChange,
    visitId: 17,
    token: "visit-token",
    lang: "en",
    copy,
    onSigned,
  });
  return { controller, onOpenChange, onSigned };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signMutation.isPending = false;
  mocks.useState.mockImplementation(initial => {
    const index = mocks.stateIndex++;
    const setter = vi.fn();
    mocks.stateSetters.push(setter);
    return [
      index < mocks.stateValues.length ? mocks.stateValues[index] : initial,
      setter,
    ];
  });
  mocks.useRef.mockImplementation(initial => {
    const ref = { current: initial };
    mocks.refObjects.push(ref);
    mocks.refIndex += 1;
    return ref;
  });
  mocks.useEffect.mockImplementation(effect => {
    mocks.effects.push(effect);
  });
  mocks.generateMutation.mutateAsync.mockResolvedValue({
    ...completeForm,
    source: "generated",
  });
  mocks.signMutation.mutateAsync.mockResolvedValue(undefined);
  mocks.invalidateGetByToken.mockResolvedValue(undefined);
  mocks.invalidateListMyAppointments.mockResolvedValue(undefined);
  mocks.invalidateListMine.mockResolvedValue(undefined);
  mocks.invalidateRoomMessages.mockResolvedValue(undefined);
  vi.stubGlobal("window", {
    setTimeout: vi.fn(callback => {
      callback();
      return 10;
    }),
    clearTimeout: vi.fn(),
    setInterval: vi.fn(() => 20),
    clearInterval: vi.fn(),
  });
});

describe("useMedicalSummaryDraftController", () => {
  it("keeps default form and action availability stable", () => {
    const { controller } = renderController();

    expect(controller.form).toEqual(EMPTY_DRAFT_FORM);
    expect(controller.errorMessage).toBeNull();
    expect(controller.statusMessage).toBeNull();
    expect(controller.disableClose).toBe(false);
    expect(controller.disableRegenerate).toBe(false);
    expect(controller.disableSign).toBe(false);
    expect(mocks.effects).toHaveLength(5);
  });

  it("marks field edits dirty without changing other form fields", () => {
    const { controller } = renderController();
    controller.setField("chiefComplaint")({
      target: { value: "Updated complaint" },
    } as React.ChangeEvent<HTMLTextAreaElement>);

    const updateForm = mocks.stateSetters[0].mock.calls[0]?.[0];
    expect(updateForm(completeForm)).toEqual({
      ...completeForm,
      chiefComplaint: "Updated complaint",
    });
    expect(mocks.stateSetters[7]).toHaveBeenCalledWith(true);
    expect(mocks.stateSetters[2]).toHaveBeenCalledWith(null);
    expect(mocks.refObjects[2]?.current).toBe(true);
  });

  it("loads and applies a generated draft with unchanged request inputs", async () => {
    const { controller } = renderController();
    await controller.loadDraft(false);

    expect(mocks.generateMutation.mutateAsync).toHaveBeenCalledWith({
      appointmentId: 17,
      token: "visit-token",
      lang: "en",
      forceRegenerate: false,
    });
    expect(mocks.stateSetters[0]).toHaveBeenCalledWith(completeForm);
    expect(mocks.stateSetters[4]).toHaveBeenNthCalledWith(1, 120);
    expect(mocks.stateSetters[3]).toHaveBeenLastCalledWith(false);
    expect(mocks.stateSetters[8]).toHaveBeenCalledWith(true);
  });

  it("polls pending initial drafts before applying the result", async () => {
    mocks.generateMutation.mutateAsync
      .mockResolvedValueOnce({ ...completeForm, source: "pending" })
      .mockResolvedValueOnce({ ...completeForm, source: "generated" });
    const { controller } = renderController();

    await controller.loadDraft(false);

    expect(mocks.generateMutation.mutateAsync).toHaveBeenCalledTimes(2);
    expect(window.setTimeout).toHaveBeenCalledWith(expect.any(Function), 2000);
    expect(mocks.stateSetters[0]).toHaveBeenCalledWith(completeForm);
  });

  it("does not overwrite edits unless regeneration was forced", async () => {
    const { controller } = renderController();
    controller.setField("planRecommendations")({
      target: { value: "Edited plan" },
    } as React.ChangeEvent<HTMLTextAreaElement>);
    mocks.stateSetters[0].mockClear();

    await controller.loadDraft(false);
    expect(mocks.stateSetters[0]).not.toHaveBeenCalled();

    await controller.loadDraft(true);
    expect(mocks.stateSetters[0]).toHaveBeenCalledWith(completeForm);
  });

  it("ignores stale draft responses and stale errors", async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    const first = new Promise(resolve => {
      resolveFirst = resolve;
    });
    mocks.generateMutation.mutateAsync
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({ ...completeForm, source: "generated" });
    const { controller } = renderController();

    const staleLoad = controller.loadDraft(false);
    await controller.loadDraft(false);
    resolveFirst({ ...completeForm, source: "generated" });
    await staleLoad;
    expect(mocks.stateSetters[0]).toHaveBeenCalledTimes(1);

    let rejectStale: (error: unknown) => void = () => undefined;
    mocks.generateMutation.mutateAsync.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectStale = reject;
      })
    );
    const staleFailure = controller.loadDraft(false);
    await controller.loadDraft(false);
    rejectStale(new Error("stale failure"));
    await staleFailure;
    expect(mocks.stateSetters[1]).not.toHaveBeenCalledWith("stale failure");
  });

  it("shows draft errors using server messages and fallback copy", async () => {
    mocks.generateMutation.mutateAsync.mockRejectedValueOnce(
      new Error("generation failed")
    );
    const { controller } = renderController();
    await controller.loadDraft(false);
    expect(mocks.stateSetters[1]).toHaveBeenLastCalledWith("generation failed");

    mocks.generateMutation.mutateAsync.mockRejectedValueOnce("unknown");
    await controller.loadDraft(false);
    expect(mocks.stateSetters[1]).toHaveBeenLastCalledWith(
      copy.draftFailedText
    );
  });

  it("validates required fields before signing", async () => {
    const { controller } = renderController();
    await controller.handleSign();

    expect(mocks.signMutation.mutateAsync).not.toHaveBeenCalled();
    expect(mocks.stateSetters[1]).toHaveBeenLastCalledWith(
      copy.requiredFieldsText
    );
  });

  it("signs, invalidates all consumers, closes, and notifies", async () => {
    const { controller, onOpenChange, onSigned } = renderController([
      completeForm,
    ]);
    await controller.handleSign();

    expect(mocks.signMutation.mutateAsync).toHaveBeenCalledWith({
      appointmentId: 17,
      token: "visit-token",
      ...completeForm,
    });
    expect(mocks.invalidateGetByToken).toHaveBeenCalledWith({
      appointmentId: 17,
      token: "visit-token",
      lang: "en",
    });
    expect(mocks.invalidateListMyAppointments).toHaveBeenCalledWith();
    expect(mocks.invalidateListMine).toHaveBeenCalledWith();
    expect(mocks.invalidateRoomMessages).toHaveBeenCalledWith({
      token: "visit-token",
      limit: 50,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(copy.signSuccessText);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSigned).toHaveBeenCalledWith();
  });

  it("keeps the modal open and reports sign failures", async () => {
    mocks.signMutation.mutateAsync.mockRejectedValueOnce(new Error("denied"));
    const { controller, onOpenChange } = renderController([completeForm]);
    await controller.handleSign();

    expect(mocks.stateSetters[1]).toHaveBeenLastCalledWith("denied");
    expect(mocks.toastError).toHaveBeenCalledWith("denied");
    expect(onOpenChange).not.toHaveBeenCalled();

    mocks.signMutation.mutateAsync.mockRejectedValueOnce("unknown");
    await controller.handleSign();
    expect(mocks.toastError).toHaveBeenLastCalledWith(copy.signFailedText);
  });

  it("auto-loads only the first open draft", async () => {
    renderController([], { open: true });
    mocks.effects[2]?.();
    await Promise.resolve();
    expect(mocks.generateMutation.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("runs countdown, timeout, auto-load, reset, and cleanup effects", async () => {
    const values = [
      EMPTY_DRAFT_FORM,
      null,
      null,
      true,
      0,
      false,
      0,
      false,
      false,
    ];
    const { controller } = renderController(values);

    const stopCountdown = mocks.effects[0]?.();
    const intervalCallback = vi.mocked(window.setInterval).mock.calls[0]?.[0];
    intervalCallback?.();
    const countdownUpdate = mocks.stateSetters[4].mock.calls[0]?.[0];
    expect(countdownUpdate(2)).toBe(1);
    expect(countdownUpdate(null)).toBeNull();
    stopCountdown?.();
    expect(window.clearInterval).toHaveBeenCalledWith(20);

    mocks.effects[1]?.();
    expect(mocks.stateSetters[5]).toHaveBeenCalledWith(true);
    expect(mocks.stateSetters[1]).toHaveBeenCalledWith(copy.draftTimeoutText);
    expect(mocks.stateSetters[2]).toHaveBeenCalledWith(
      copy.draftTimeoutHintText
    );

    mocks.effects[2]?.();
    await Promise.resolve();
    expect(mocks.generateMutation.mutateAsync).not.toHaveBeenCalled();
    mocks.effects[3]?.();
    const cleanup = mocks.effects[4]?.();
    cleanup?.();
    controller.resetDraftState();
    expect(mocks.stateSetters[0]).toHaveBeenCalledWith(EMPTY_DRAFT_FORM);
  });

  it("reflects signing and draft-generation button locks", () => {
    mocks.signMutation.isPending = true;
    const signing = renderController().controller;
    expect(signing.disableClose).toBe(true);
    expect(signing.disableRegenerate).toBe(true);
    expect(signing.disableSign).toBe(true);

    mocks.signMutation.isPending = false;
    const generating = renderController([
      EMPTY_DRAFT_FORM,
      null,
      null,
      true,
      30,
      false,
    ]).controller;
    expect(generating.disableRegenerate).toBe(true);
    expect(generating.disableSign).toBe(true);

    const timedOut = renderController([
      EMPTY_DRAFT_FORM,
      null,
      null,
      true,
      0,
      true,
    ]).controller;
    expect(timedOut.disableSign).toBe(false);
  });
});
