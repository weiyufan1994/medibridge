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
  },
  zh: {
    invalidToken: "Missing or invalid token.",
    appointmentNotFound: "Appointment not found.",
    noMessages: "No messages yet. Start your consultation below.",
    sendFailed: "Failed to send message. Please retry.",
    composerPlaceholder: "输入消息，描述你的问题...",
    composerHint: "Enter 发送，Shift+Enter 换行",
    historyRetentionNote: "聊天记录保留 7 天",
  },
} as const;

export function getVisitCopy(lang: Lang) {
  return visitCopyByLang[lang];
}
