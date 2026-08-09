import * as providerManager from "./providerManager";

export type PaymentProvider = providerManager.PaymentProvider;

export const paymentProviderApi = {
  get createCheckoutSession() {
    return providerManager.createPaymentCheckoutSession;
  },
  async captureOrFinalize(input: {
    provider: PaymentProvider;
    providerSessionId: string;
  }) {
    return providerManager
      .resolvePaymentAdapter(input.provider)
      .captureOrFinalize({ providerSessionId: input.providerSessionId });
  },
  get refund() {
    return providerManager.refundPayment;
  },
};
