import type { ReferralLang } from "@/features/referrals/copy";
import { getLatestReferralProgressUpdate } from "@/features/referrals/presentation";

type ReferralOperationWithIdLike = {
  id: number;
  actionType: string;
  actionPayload: unknown;
  createdAt: Date | string;
};

export type ReferralProgressUpdate = {
  id: number;
  text: string;
  updatedAt: Date | string | null;
};

export function getReferralProgressUpdates(input: {
  operations: readonly ReferralOperationWithIdLike[];
  lang: ReferralLang;
  consultationTime?: Date | string | null;
}): ReferralProgressUpdate[] {
  return input.operations.map((operation, index) => ({
    id: operation.id,
    ...getLatestReferralProgressUpdate({
      operation,
      lang: input.lang,
      consultationTime: index === 0 ? input.consultationTime : null,
    }),
  }));
}
