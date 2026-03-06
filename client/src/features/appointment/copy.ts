import { getTriageCopy } from "@/features/triage/copy";

type Lang = "en" | "zh";

export function getAppointmentCopy(lang: Lang) {
  const t = getTriageCopy(lang);

  const isZh = lang === "zh";
  return {
    bookingTitle: t.bookingTitle,
    bookingDesc: t.bookingDesc,
    bookingEmail: t.bookingEmail,
    bookingEmailPlaceholder: t.bookingEmailPlaceholder,
    bookingTime: t.bookingTime,
    bookingType: t.bookingType,
    bookingPackage: isZh ? "服务套餐" : "Consultation Package",
    bookingPackageFallback: isZh
      ? "请选择一个套餐后继续。"
      : "Choose a package to continue.",
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
    bookingChiefComplaintRequired: isZh
      ? "请至少填写主诉后再创建预约。"
      : "Please provide chief complaint before creating booking.",
    intakeTitle: isZh ? "诊前信息（结构化）" : "Pre-visit Intake",
    intakeDesc: isZh
      ? "先收集关键信息，医生可更快进入问诊。"
      : "Collect key context before the doctor session.",
    intakeChiefComplaint: isZh ? "主诉" : "Chief complaint",
    intakeDuration: isZh ? "病程/持续时间" : "Duration",
    intakeMedicalHistory: isZh ? "既往史" : "Medical history",
    intakeMedications: isZh ? "当前用药" : "Current medications",
    intakeAllergies: isZh ? "过敏史" : "Allergies",
    intakeAgeGroup: isZh ? "年龄段" : "Age group",
    intakeOtherSymptoms: isZh ? "其他症状" : "Other symptoms",
    intakePlaceholderChiefComplaint: isZh
      ? "例如：反复咳嗽、夜间加重"
      : "e.g. recurrent cough, worse at night",
    intakePlaceholderDuration: isZh ? "例如：3天 / 2周" : "e.g. 3 days / 2 weeks",
    intakePlaceholderMedicalHistory: isZh
      ? "例如：高血压、糖尿病、手术史"
      : "e.g. hypertension, diabetes, surgery history",
    intakePlaceholderMedications: isZh
      ? "例如：阿司匹林 100mg 每日一次"
      : "e.g. aspirin 100mg once daily",
    intakePlaceholderAllergies: isZh
      ? "例如：青霉素过敏"
      : "e.g. penicillin allergy",
    intakePlaceholderAgeGroup: isZh ? "例如：30-39岁" : "e.g. 30-39",
    intakePlaceholderOtherSymptoms: isZh
      ? "例如：发热、乏力、头痛"
      : "e.g. fever, fatigue, headache",
  } as const;
}
