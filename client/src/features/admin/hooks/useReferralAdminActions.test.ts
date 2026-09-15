import type { Dispatch, SetStateAction } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReferralAdminActions } from "./useReferralAdminActions";

const hookState = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
}));
const mutationOptions = vi.hoisted(
  () =>
    new Map<
      string,
      {
        onSuccess?: (...args: unknown[]) => unknown;
        onError?: (error: unknown) => void;
      }
    >()
);

vi.mock("react", async importOriginal => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: <S>(
    initialValue: S | (() => S)
  ): [S, Dispatch<SetStateAction<S>>] => {
    const stateIndex = hookState.cursor++;
    if (!(stateIndex in hookState.values)) {
      hookState.values[stateIndex] =
        typeof initialValue === "function"
          ? (initialValue as () => S)()
          : initialValue;
    }

    return [
      hookState.values[stateIndex] as S,
      value => {
        hookState.values[stateIndex] =
          typeof value === "function"
            ? (value as (current: S) => S)(hookState.values[stateIndex] as S)
            : value;
      },
    ];
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    referrals: Object.fromEntries(
      [
        "claimOrder",
        "assignOrder",
        "assignOrderContact",
        "updateOrderStatus",
        "addInternalNote",
        "publishPatientProgressUpdate",
        "recordContactAttempt",
        "recordBookingResult",
        "beginTimeCoordination",
        "setConsultationTime",
        "initiateRefund",
        "reviewRefund",
      ].map(name => [
        name,
        {
          useMutation: (options: object) => {
            mutationOptions.set(name, options);
            return { isPending: false, mutateAsync: vi.fn() };
          },
        },
      ])
    ),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderActions(selectedOrderId: number | null) {
  hookState.cursor = 0;
  return useReferralAdminActions({
    lang: "zh",
    selectedOrderId,
    refreshData: vi.fn().mockResolvedValue(undefined),
    onStatusSaved: vi.fn(),
    onConsultationSaved: vi.fn(),
  });
}

describe("referral coordination drafts", () => {
  beforeEach(() => {
    hookState.values = [];
    hookState.cursor = 0;
    mutationOptions.clear();
  });

  it("keeps the coordination note with its order when the selection changes", () => {
    renderActions(101).setCoordinationNote("患者一可用时段");

    const secondOrder = renderActions(102);
    expect(secondOrder.coordinationNote).toBe("");
    secondOrder.setCoordinationNote("患者二可用时段");

    expect(renderActions(101).coordinationNote).toBe("患者一可用时段");
    expect(renderActions(102).coordinationNote).toBe("患者二可用时段");
  });

  it("clears only the submitted order when a request succeeds after selection changes", async () => {
    renderActions(101).setCoordinationNote("已提交的协调说明");
    const submittedOptions = mutationOptions.get("beginTimeCoordination");
    expect(submittedOptions?.onSuccess).toBeTypeOf("function");

    renderActions(102).setCoordinationNote("另一个订单未提交的协调说明");
    await submittedOptions?.onSuccess?.({}, { orderId: 101 });

    expect(renderActions(101).coordinationNote).toBe("");
    expect(renderActions(102).coordinationNote).toBe(
      "另一个订单未提交的协调说明"
    );
  });

  it("preserves the order's draft after a failed request", () => {
    renderActions(101).setCoordinationNote("仍需重试的协调说明");
    mutationOptions
      .get("beginTimeCoordination")
      ?.onError?.(new Error("Failed"));

    expect(renderActions(101).coordinationNote).toBe("仍需重试的协调说明");
  });

  it("does not reuse an order note while no order is selected", () => {
    renderActions(101).setCoordinationNote("订单一的说明");
    const unselected = renderActions(null);

    expect(unselected.coordinationNote).toBe("");
    unselected.setCoordinationNote("尚未选择订单的说明");
    expect(renderActions(101).coordinationNote).toBe("订单一的说明");
  });
});
