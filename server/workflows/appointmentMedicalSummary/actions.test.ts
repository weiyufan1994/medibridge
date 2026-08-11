import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../modules/appointments/publicApi", () => ({
  appointmentMedicalSummaryApi: {
    generateMedicalSummaryDraftByTokenFlow: vi.fn(),
  },
}));

vi.mock("../../modules/visit/publicApi", () => ({
  visitMedicalSummaryApi: {
    getRecentMessages: vi.fn(),
  },
}));

import { appointmentMedicalSummaryApi } from "../../modules/appointments/publicApi";
import { visitMedicalSummaryApi } from "../../modules/visit/publicApi";
import { generateMedicalSummaryDraft } from "./actions";

describe("appointment medical summary workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("injects the visit transcript reader into summary generation", async () => {
    const input = {
      appointmentId: 17,
      token: "doctor-token-value",
      lang: "zh" as const,
      forceRegenerate: true,
      requestMetadata: {
        clientIp: null,
        forwardedHost: null,
        forwardedProto: null,
        host: null,
        protocol: null,
        requestId: null,
        userAgent: null,
      },
    } as never;

    await generateMedicalSummaryDraft(input);

    expect(
      appointmentMedicalSummaryApi.generateMedicalSummaryDraftByTokenFlow
    ).toHaveBeenCalledWith({
      ...input,
      loadRecentMessages: visitMedicalSummaryApi.getRecentMessages,
    });
  });
});
