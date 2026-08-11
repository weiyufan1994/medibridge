import {
  toReferralDisplayDepartment,
  toReferralDisplayHospital,
} from "./presentation";
import * as referralRepo from "./repo";

type NullableLocalHospital = Awaited<
  ReturnType<typeof referralRepo.getHospitalById>
> | null;
type NullableLocalDepartment = Awaited<
  ReturnType<typeof referralRepo.getDepartmentById>
> | null;

export function buildOrderDisplayContext(input: {
  order: {
    recommendedHospitalName: string | null;
    recommendedDepartmentName: string | null;
    recommendedDepartmentNameEn: string | null;
    recommendationReason: string | null;
    manualFulfillmentRequired: number;
  };
  hospital: NullableLocalHospital;
  department: NullableLocalDepartment;
}) {
  return {
    manualFulfillmentRequired: input.order.manualFulfillmentRequired === 1,
    recommendationReason: input.order.recommendationReason ?? null,
    hospital: toReferralDisplayHospital({
      hospital: input.hospital,
      snapshotHospitalName:
        input.order.recommendedHospitalName ?? input.hospital?.name ?? "",
      snapshotCity: input.hospital?.city ?? null,
    }),
    department: toReferralDisplayDepartment({
      department: input.department,
      snapshotDepartmentName:
        input.order.recommendedDepartmentName ?? input.department?.name ?? "",
      snapshotDepartmentNameEn:
        input.order.recommendedDepartmentNameEn ??
        input.department?.nameEn ??
        "",
    }),
  };
}

export function toConsultationArrangement(
  order: NonNullable<
    Awaited<ReturnType<typeof referralRepo.getReferralOrderById>>
  >
) {
  if (
    !order.consultationTime ||
    !order.consultationTimeZone ||
    !order.consultationProviderName ||
    !order.consultationPlatform ||
    !order.consultationJoinUrl ||
    !order.consultationInstructions
  ) {
    return null;
  }

  return {
    scheduledAt: order.consultationTime,
    timeZone: order.consultationTimeZone,
    providerName: order.consultationProviderName,
    platform: order.consultationPlatform,
    joinUrl: order.consultationJoinUrl,
    instructions: order.consultationInstructions,
  };
}
