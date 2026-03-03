import { getTriageCopy } from "@/features/triage/copy";

type Lang = "en" | "zh";

export function getAppointmentCopy(lang: Lang) {
  const t = getTriageCopy(lang);

  return {
    bookingTitle: t.bookingTitle,
    bookingDesc: t.bookingDesc,
    bookingEmail: t.bookingEmail,
    bookingEmailPlaceholder: t.bookingEmailPlaceholder,
    bookingTime: t.bookingTime,
    bookingType: t.bookingType,
    bookingTypeOnline: t.bookingTypeOnline,
    bookingTypeVideo: t.bookingTypeVideo,
    bookingTypeInPerson: t.bookingTypeInPerson,
    bookingCancel: t.bookingCancel,
    bookingConfirm: t.bookingConfirm,
    bookingCreating: t.bookingCreating,
    bookingInvalid: t.bookingInvalid,
    bookingSuccess: t.bookingSuccess,
    bookingFailed: t.bookingFailed,
    bookingOtpLabel: t.bookingOtpLabel,
    bookingOtpPlaceholder: t.bookingOtpPlaceholder,
    bookingSendOtp: t.bookingSendOtp,
    bookingSendingOtp: t.bookingSendingOtp,
    bookingResendOtp: t.bookingResendOtp,
    bookingOtpSent: t.bookingOtpSent,
    bookingOtpCooldown: t.bookingOtpCooldown,
    bookingOtpRequired: t.bookingOtpRequired,
    bookingVerifyingIdentity: t.bookingVerifyingIdentity,
    bookingIdentityVerified: t.bookingIdentityVerified,
    bookingIdentityVerifyFailed: t.bookingIdentityVerifyFailed,
    bookingDeviceIdMissing: t.bookingDeviceIdMissing,
  } as const;
}
