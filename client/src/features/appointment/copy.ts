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
    step1Title: isZh ? "Step 1：选择时间与服务套餐" : "Step 1: Select Time & Service Package",
    step1Desc: isZh
      ? "先确认预约对象、时间与服务套餐。"
      : "Confirm doctor, time slot, and service package first.",
    step2Title: isZh ? "Step 2：确认病历信息" : "Step 2: Confirm Medical Info",
    step2Desc: isZh
      ? "AI 问诊信息已自动填写，请核对后提交。"
      : "AI triage data has been auto-filled. Review before submission.",
    continueStep: isZh ? "继续" : "Continue",
    backStep: isZh ? "返回上一步" : "Back",
    doctorCardTitle: isZh ? "预约医生" : "Booking Doctor",
    selectDate: isZh ? "选择日期" : "Select Date",
    availableSlots: isZh ? "可选时间段" : "Available Time Slots",
    recommendedTag: isZh ? "推荐" : "Recommended",
    customTimeToggle: isZh
      ? "或在医生接诊时间内选择具体时间"
      : "Or select a specific time within doctor's window",
    customTimeLabel: isZh ? "自定义时间" : "Custom Time",
    customTimePlaceholder: isZh ? "请选择具体时间" : "Select a specific time",
    bookingInvalidTime: isZh ? "请输入有效的时间格式" : "Invalid time format",
    bookingInvalidFormat: isZh ? "请输入有效的时间格式" : "Invalid time format",
    bookingPastDate: isZh ? "不能选择过去日期" : "Cannot select past dates",
    bookingPastTimeToday: isZh ? "不能选择已经过去的时间" : "Cannot select a past time today",
    bookingOutsideWorkingHours: isZh ? "超出医生接诊时间" : "Outside doctor's working hours",
    bookingOutOfHours: isZh
      ? "超出医生工作时间（可接诊：09:00 - 18:00）"
      : "Out of working hours (Available: 09:00 - 18:00)",
    quickSlotsLabel: isZh ? "快捷推荐时间" : "Quick recommended times",
    bookingRangeHint: isZh
      ? "医生接诊窗口：您的当地时间 {range}"
      : "Doctor window: your local time {range}",
    doctorAvailableRangeHint: isZh
      ? "医生可接诊：您的当地时间 {range}"
      : "Doctor available: {range} (Local Time)",
    localTimeInputLabel: isZh
      ? "当地时间"
      : "Local Time",
    bookingLocalTime: isZh ? "当地时间" : "Local Time",
    localTimeShortLabel: isZh ? "当地时间" : "Local Time",
    chinaMirrorPrefix: isZh
      ? "-> 中国北京时间 (CST):"
      : "-> China Standard Time (CST):",
    chinaMirrorPending: isZh ? "--" : "--",
    doctorAvailableStatus: isZh
      ? "医生可用 (Doctor Available)"
      : "Doctor Available",
    doctorUnavailableStatus: isZh
      ? "超出医生工作时间"
      : "Out of working hours",
    bookingOutsideWorkingHoursWithRange: isZh
      ? "超出医生工作时间（可接诊：{range}）"
      : "Out of working hours (Available: {range})",
    doctorStatusPending: isZh
      ? "请输入完整时间以查看医生状态"
      : "Enter full time to check doctor availability",
    timezoneSyncPrefix: isZh ? "当前：" : "Current:",
    localTimeLabel: isZh ? "当地时间" : "Local Time",
    chinaTimeLabel: isZh ? "中国时间" : "China Time",
    aiSummaryPreviewTitle: isZh ? "AI 问诊摘要（已自动填写）" : "AI Triage Summary (Auto-filled)",
    aiSummaryPreviewDesc: isZh
      ? "以下信息已由 AI 会话自动同步。"
      : "The following info was synced automatically from AI triage.",
    editInfo: isZh ? "编辑信息" : "Edit Info",
    hideEditInfo: isZh ? "收起编辑" : "Hide Edit",
    doctorDetailConfirmBook: isZh ? "确认选择并预约" : "Confirm & Book",
    doctorFallback: t.doctorFallback,
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
