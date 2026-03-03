export type TriageLang = "en" | "zh";

type TriageExtraction = {
  symptoms?: string;
  duration?: string;
  urgency?: "low" | "medium" | "high";
};

type TriageWhatsappMessageParams = {
  lang: TriageLang;
  doctorName: string;
  summary: string;
  extraction?: TriageExtraction;
  departmentName: string;
  reason: string;
  bookingCode: string;
};

export const TRIAGE_COPY = {
  en: {
    title: "AI Triage Consultation",
    subtitle:
      "The triage nurse collects key details first, then generates a summary and doctor recommendations.",
    placeholder: "Describe your symptoms, duration, and medical history...",
    typing: "AI is reviewing your triage details...",
    requestError:
      "Triage service is temporarily unavailable. Please try again shortly.",
    fallbackReply:
      "Sorry, the triage service is busy right now. Please try again in a moment.",
    completed: "Triage is complete. Summary and recommendations are ready.",
    summaryTitle: "Triage Summary",
    summaryDesc: "A structured summary to carry into booking/session creation.",
    summaryEmpty: "Summary will appear after triage is complete.",
    doctorTitle: "Recommended Doctors",
    doctorDesc: "Top 3-5 doctors matched by extracted keywords",
    searching: "Matching doctors...",
    noDoctor:
      "No doctors matched yet. Try adding more specific symptom details.",
    noBio: "No profile details available yet.",
    viewProfile: "View Profile",
    chooseBook: "Choose & Book",
    whatsapp: "Book via WhatsApp",
    startNew: "Start New Session",
    disclaimerTitle: "Medical Disclaimer",
    disclaimerDesc:
      "AI suggestions are for triage and doctor matching only. They are not a diagnosis.",
    disclaimerLine1:
      "Do not share highly sensitive identity details (ID/passport numbers) in chat.",
    disclaimerLine2:
      "If you have severe chest pain, breathing distress, stroke signs, heavy bleeding, or any emergency symptoms, call local emergency services immediately.",
    cancel: "Cancel",
    understand: "I Understand",
    rating: "Rating",
    doctorFallback: "Recommended Doctor",
    bookingTitle: "Book Appointment",
    bookingDesc:
      "Provide email and preferred time to receive a secure magic link.",
    bookingEmail: "Email",
    bookingTime: "Scheduled Time",
    bookingType: "Appointment Type",
    bookingTypeOnline: "Online Chat",
    bookingTypeVideo: "Video Call",
    bookingTypeInPerson: "In Person",
    bookingCancel: "Cancel",
    bookingConfirm: "Create Booking",
    bookingCreating: "Creating...",
    bookingInvalid: "Please complete email and time.",
    bookingSuccess: "Booking created. Opening your magic link.",
    bookingFailed: "Failed to create booking. Please try again.",
    bookingEmailPlaceholder: "you@example.com",
    bookingOtpLabel: "Email Verification Code",
    bookingOtpPlaceholder: "Enter 6-digit code",
    bookingSendOtp: "Send code",
    bookingSendingOtp: "Sending...",
    bookingResendOtp: "Resend code",
    bookingOtpSent: "Verification code sent. Please check your email.",
    bookingOtpCooldown: "Retry in {seconds}s",
    bookingOtpRequired: "Please enter the 6-digit verification code.",
    bookingVerifyingIdentity: "Verifying identity...",
    bookingIdentityVerified: "Email verified.",
    bookingIdentityVerifyFailed: "Email verification failed. Please try again.",
    bookingDeviceIdMissing: "Cannot read device id. Please refresh and try again.",
    initialAssistantMessage:
      "Hi, I am your triage nurse. Please share your main symptoms and how long they have lasted.",
    reasonFallback: "Recommended based on triage details",
    bookingSummaryFallback: "Symptom details shared in AI chat.",
    bookingSymptomsFallback: "Shared in triage chat",
    bookingDurationFallback: "Unspecified",
  },
  zh: {
    title: "AI 预诊分诊",
    subtitle: "分诊护士先收集关键信息，再生成摘要和医生推荐。",
    placeholder: "请输入症状、持续时间、既往史等信息...",
    typing: "AI 正在整理分诊信息...",
    requestError: "分诊服务暂时不可用，请稍后重试。",
    fallbackReply: "抱歉，当前分诊服务繁忙。请稍后再试。",
    completed: "分诊已完成，摘要和推荐结果已生成。",
    summaryTitle: "病情摘要",
    summaryDesc: "可直接用于下一步预约/建会话的结构化摘要。",
    summaryEmpty: "尚未完成分诊，摘要会在完成后显示。",
    doctorTitle: "推荐医生",
    doctorDesc: "基于关键词匹配前 3-5 位医生",
    searching: "正在匹配医生...",
    noDoctor: "未检索到匹配医生，请补充更具体症状。",
    noBio: "暂无医生简介",
    viewProfile: "查看详情",
    chooseBook: "选择并预约",
    whatsapp: "WhatsApp 预约",
    startNew: "开始新会话",
    disclaimerTitle: "医疗免责声明",
    disclaimerDesc: "AI 建议仅用于分诊与医生匹配，不构成医疗诊断。",
    disclaimerLine1: "请勿在对话中发送高敏感身份信息（证件号/护照号等）。",
    disclaimerLine2:
      "如出现胸痛、呼吸困难、中风征象、大出血等急症，请立即联系当地急救服务。",
    cancel: "取消",
    understand: "我已知悉",
    rating: "评分",
    doctorFallback: "推荐医生",
    bookingTitle: "创建预约",
    bookingDesc: "填写邮箱与预约时间，系统将发送安全魔法链接。",
    bookingEmail: "邮箱",
    bookingTime: "预约时间",
    bookingType: "预约类型",
    bookingTypeOnline: "在线图文",
    bookingTypeVideo: "视频问诊",
    bookingTypeInPerson: "线下面诊",
    bookingCancel: "取消",
    bookingConfirm: "创建预约",
    bookingCreating: "创建中...",
    bookingInvalid: "请完整填写邮箱和预约时间。",
    bookingSuccess: "预约创建成功，正在打开魔法链接。",
    bookingFailed: "预约创建失败，请稍后重试。",
    bookingEmailPlaceholder: "you@example.com",
    bookingOtpLabel: "邮箱验证码",
    bookingOtpPlaceholder: "请输入 6 位验证码",
    bookingSendOtp: "发送验证码",
    bookingSendingOtp: "发送中...",
    bookingResendOtp: "重新发送",
    bookingOtpSent: "验证码已发送，请查看邮箱。",
    bookingOtpCooldown: "{seconds}s 后可重试",
    bookingOtpRequired: "请输入 6 位验证码。",
    bookingVerifyingIdentity: "正在验证身份...",
    bookingIdentityVerified: "邮箱验证成功。",
    bookingIdentityVerifyFailed: "邮箱验证失败，请重试。",
    bookingDeviceIdMissing: "无法获取设备标识，请刷新页面后重试。",
    initialAssistantMessage:
      "您好，我是分诊护士。请先描述当前最主要的不适症状，以及大概持续了多久。",
    reasonFallback: "基于分诊信息推荐",
    bookingSummaryFallback: "已在 AI 对话中提供症状描述",
    bookingSymptomsFallback: "已在分诊中描述",
    bookingDurationFallback: "未明确",
  },
} as const;

export const getTriageCopy = (lang: TriageLang) => TRIAGE_COPY[lang];

export const buildTriageWhatsappMessage = ({
  lang,
  doctorName,
  summary,
  extraction,
  departmentName,
  reason,
  bookingCode,
}: TriageWhatsappMessageParams) => {
  const t = getTriageCopy(lang);

  if (lang === "zh") {
    return [
      `你好，我想预约 ${doctorName} 医生。`,
      `分诊摘要：${summary || t.bookingSummaryFallback}`,
      `症状：${extraction?.symptoms || t.bookingSymptomsFallback}`,
      `病程：${extraction?.duration || t.bookingDurationFallback}`,
      `紧急度：${extraction?.urgency || "medium"}`,
      `推荐科室：${departmentName}`,
      `推荐理由：${reason}`,
      `会话编号：#${bookingCode}`,
    ].join("\n");
  }

  return [
    `Hello, I would like to book an appointment with Dr. ${doctorName}.`,
    `AI triage summary: ${summary || t.bookingSummaryFallback}`,
    `Symptoms: ${extraction?.symptoms || t.bookingSymptomsFallback}`,
    `Duration: ${extraction?.duration || t.bookingDurationFallback}`,
    `Urgency: ${extraction?.urgency || "medium"}`,
    `Recommended department: ${departmentName}`,
    `Reason: ${reason}`,
    `Session code: #${bookingCode}`,
  ].join("\n");
};
