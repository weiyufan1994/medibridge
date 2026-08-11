import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../modules/appointments/publicApi", () => ({
  appointmentBookingApi: {
    createCheckoutFromCreateInput: vi.fn(),
    createCheckoutFromCreateV2Input: vi.fn(),
  },
}));

vi.mock("../../modules/payments/publicApi", () => ({
  paymentProviderApi: {
    createCheckoutSession: vi.fn(),
  },
}));

import { appointmentBookingApi } from "../../modules/appointments/publicApi";
import { paymentProviderApi } from "../../modules/payments/publicApi";
import {
  createAppointmentCheckout,
  createAppointmentCheckoutV2,
} from "./actions";

describe("appointment booking workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [
      "legacy",
      createAppointmentCheckout,
      appointmentBookingApi.createCheckoutFromCreateInput,
    ],
    [
      "v2",
      createAppointmentCheckoutV2,
      appointmentBookingApi.createCheckoutFromCreateV2Input,
    ],
  ])(
    "injects the payment provider for the %s input",
    async (_name, run, action) => {
      const input = {
        createInput: { marker: "input" },
        userId: 12,
        userEmail: "patient@example.com",
        req: { headers: {} },
      } as never;

      await run(input);

      expect(action).toHaveBeenCalledWith({
        ...input,
        createCheckoutSession: paymentProviderApi.createCheckoutSession,
      });
    }
  );
});
