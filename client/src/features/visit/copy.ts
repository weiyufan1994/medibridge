type Lang = "en" | "zh";

const visitCopyByLang = {
  en: {
    invalidToken: "Missing or invalid token.",
    appointmentNotFound: "Appointment not found.",
    noMessages: "No messages yet. Start your consultation below.",
    sendFailed: "Failed to send message. Please retry.",
    composerPlaceholder: "Type your message and describe your concern...",
    composerHint: "Enter to send, Shift+Enter for new line",
    historyRetentionNote: "聊天记录保留 7 天",
    intakeTitle: "Pre-visit Intake",
    intakeEmpty: "No structured intake provided.",
    intakeChiefComplaint: "Chief complaint",
    intakeDuration: "Duration",
    intakeMedicalHistory: "Medical history",
    intakeMedications: "Current medications",
    intakeAllergies: "Allergies",
    intakeAgeGroup: "Age group",
    intakeOtherSymptoms: "Other symptoms",
  },
  zh: {
    invalidToken: "Missing or invalid token.",
    appointmentNotFound: "Appointment not found.",
    noMessages: "No messages yet. Start your consultation below.",
    sendFailed: "Failed to send message. Please retry.",
    composerPlaceholder: "输入消息，描述你的问题...",
    composerHint: "Enter 发送，Shift+Enter 换行",
    historyRetentionNote: "聊天记录保留 7 天",
    intakeTitle: "诊前结构化信息",
    intakeEmpty: "暂无结构化诊前信息。",
    intakeChiefComplaint: "主诉",
    intakeDuration: "病程/持续时间",
    intakeMedicalHistory: "既往史",
    intakeMedications: "当前用药",
    intakeAllergies: "过敏史",
    intakeAgeGroup: "年龄段",
    intakeOtherSymptoms: "其他症状",
  },
} as const;

export function getVisitCopy(lang: Lang) {
  return visitCopyByLang[lang];
}
