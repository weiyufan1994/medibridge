import * as providerManager from "./providerManager";

export type PaymentProvider = providerManager.PaymentProvider;

export const paymentProviderApi = {
  createCheckoutSession: providerManager.createPaymentCheckoutSession,
  async captureOrFinalize(input: {
    provider: PaymentProvider;
    providerSessionId: string;
  }) {
    return providerManager
      .resolvePaymentAdapter(input.provider)
      .captureOrFinalize({ providerSessionId: input.providerSessionId });
  },
  refund: providerManager.refundPayment,
};
