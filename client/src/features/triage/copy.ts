import type { LocalizedText } from "@shared/types";

export type TriageLang = "en" | "zh";

const INTERRUPTION_DETAIL_BY_RISK_CODE: Record<string, LocalizedText> = {
  CHEST_PAIN_BREATHING: {
    zh: "你描述的情况可能提示急性高风险问题。请立即前往急诊或呼叫当地急救服务；本平台不会继续提供 AI 分诊建议。",
    en: "Your symptoms may indicate an urgent high-risk condition. Please go to the emergency department or contact local emergency services immediately. AI triage will stop here.",
  },
  STROKE_NEURO_DEFICIT: {
    zh: "你提供的信息提示可能存在急性神经系统危险信号。请立即呼叫当地急救服务或尽快前往急诊。",
    en: "Your symptoms may suggest an acute neurological emergency. Please contact local emergency services or go to the emergency department immediately.",
  },
  MAJOR_BLEEDING: {
    zh: "你描述的症状可能提示活动性出血或其他急症。请立即前往急诊处理，本次 AI 分诊到此结束。",
    en: "Your symptoms may indicate active bleeding or another emergency. Please go to the emergency department immediately. AI triage is stopping now.",
  },
  SEIZURE_OR_LOSS_CONSCIOUSNESS: {
    zh: "你描述的情况可能属于急症。请立即联系当地急救服务或尽快前往急诊，本平台不会继续 AI 分诊。",
    en: "Your symptoms may represent a medical emergency. Please contact local emergency services or go to the emergency department immediately. AI triage will stop here.",
  },
  SEVERE_ALLERGIC_REACTION: {
    zh: "你描述的情况可能提示严重过敏反应。请立即联系当地急救服务或尽快前往急诊。",
    en: "Your symptoms may suggest a severe allergic reaction. Please contact local emergency services or go to the emergency department immediately.",
  },
  SUICIDE_SELF_HARM: {
    zh: "你提到的内容提示你可能正处于紧急心理危机中。请立即联系当地急救服务、危机干预热线，或尽快寻求身边可信任的人陪同帮助。",
    en: "Your message suggests an urgent mental health crisis. Please contact local emergency services, a crisis hotline, or seek immediate support from a trusted person near you.",
  },
  PEDIATRIC_HIGH_FEVER_ALERT: {
    zh: "婴幼儿高热需要尽快由线下医生评估。请尽快前往急诊或儿科急诊，本平台不会继续 AI 分诊。",
    en: "High fever in an infant or young child needs urgent in-person evaluation. Please go to urgent care or the emergency department as soon as possible.",
  },
  PREGNANCY_BLEEDING_ALERT: {
    zh: "妊娠期出血合并腹痛需要尽快线下评估。请尽快前往急诊或妇产科急诊。",
    en: "Bleeding with abdominal pain during pregnancy requires urgent in-person assessment. Please go to the emergency department or obstetric urgent care promptly.",
  },
} as const;

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
    common: {
      save: "Save",
      cancel: "Cancel",
      edit: "Edit",
      select_book: "Select & Book",
      view_profile: "View Profile",
      doctor_placeholder: "Doctor",
      specialty_unavailable: "Specialty information unavailable",
      unnamed_patient: "Unnamed patient",
      no_summary_available: "No summary available.",
    },
    triage_card: {
      summary: "Triage Summary",
      possibility: "Likely Direction",
      recommended_department: "Suggested Department",
      recommended_hospitals: "Reference Hospitals",
      next_step_title:
        "AI has completed an initial triage. Please choose a hospital to continue referral assistance.",
      next_step_description:
        "If the information looks correct, click a hospital below to continue. If you need to add more details, start a new triage session.",
      not_diagnosis:
        "This triage result is routing guidance only. It does not confirm a diagnosis.",
      browse_hospital: "Review service and place order",
      reduced_confidence_title: "Key information is still missing",
      reduced_confidence_description: (fields: string[]) =>
        `This is a preliminary routing suggestion. Please add ${fields.join(", ")} and any related symptoms to improve accuracy.`,
      critical_field_labels: {
        age: "age",
        gender: "gender",
      },
      platform_match: "In platform database",
      manual_coordination: "Manual coordination available",
      no_hospitals:
        "No reference hospitals are available yet. Please start a new triage session with more details.",
      possibility_fallback:
        "The current details suggest a broad specialty direction for in-person evaluation.",
      department_fallback: "Relevant department",
    },
    summary_form: {
      title: "AI-Organized Symptom Summary",
      description:
        "I organized your description into a structured summary. Please review and adjust anything that feels inaccurate before the next step.",
      age_gender: "Age / Gender",
      main_symptom_and_location: "Main Symptom & Location",
      duration_and_onset: "Duration & Onset",
      trauma_or_surgery: "Trauma & Surgery History",
      medical_history: "Key Underlying Conditions",
      other_symptoms: "Other Symptoms",
    },
    interruption: {
      eyebrow: "Urgent Safety Notice",
      title: "AI triage stopped due to high-risk symptoms",
      description:
        "The details you shared may suggest an urgent medical issue. Please avoid waiting in chat and seek in-person medical care immediately.",
      next_steps_title: "Recommended next steps",
      next_steps: [
        "Contact local emergency services right away if symptoms are sudden, severe, or rapidly worsening.",
        "If emergency services are not needed, go to the nearest emergency department or urgent care now.",
        "Bring your symptom timeline, medications, allergies, and any recent test results if available.",
      ],
      primary_cta: "Browse hospitals",
      secondary_cta: "Back to home",
      footer:
        "This safety stop is intended to reduce delay when urgent symptoms may be present.",
    },
    sidebar: {
      new_session: "New Session",
      today: "Today",
      previous_7_days: "Previous 7 Days",
      older: "Older",
      load_failed:
        "Failed to load session history. Please refresh and try again.",
      empty: "No previous sessions.",
      no_messages_in_session: "No messages in this session.",
      read_only_placeholder: "This is a past session (read-only)...",
    },
    status: {
      typing: "AI is typing...",
      reviewing: "AI is reviewing your triage details...",
      thinking: "AI is thinking...",
      quota_login_required:
        "Guest trial quota reached. Please sign in to continue triage.",
      message_limit_reached:
        "This consultation has reached the message limit. Please review the suggested department and hospitals now.",
      message_limit_action: "Continue with hospital selection",
    },
    patientLabel: "Patient",
    triage: {
      disclaimer:
        "AI can make mistakes. Always consult a professional doctor before making medical decisions.",
      post_complete_input_title: "Hospital selection is the main next step",
      post_complete_input_description:
        "The triage result is ready. Please prioritize clicking a hospital above to continue; if you need to add more symptoms, start a new triage session.",
    },
    doctor_detail: {
      about: "About Doctor",
      biography: "Biography",
      confirm_book: "Confirm & Book",
      years_experience: (years: number) => `${years} years experience`,
    },
    fast_intake: {
      title: "Quick Form (Optional)",
      description:
        "If chatting is inconvenient, you can switch to a short form. The default path is still AI-guided triage in 2-3 turns.",
      age: "Age",
      gender: "Gender",
      gender_placeholder: "Select gender",
      gender_male: "Male",
      gender_female: "Female",
      gender_other: "Other",
      gender_unknown: "Prefer not to say",
      main_symptom: "Main Symptom & Location",
      main_symptom_placeholder:
        "e.g. right lower abdominal pain / chest tightness / skin wound on the leg",
      duration_onset: "Duration & Onset",
      duration_onset_placeholder:
        "e.g. sudden since this morning / worsening for 3 days / recurring for 2 months",
      trauma_surgery: "Trauma & Surgery History",
      trauma_surgery_placeholder:
        "e.g. none / fell yesterday / had surgery recently",
      chronic_conditions: "Key Underlying Conditions",
      chronic_conditions_placeholder:
        "e.g. none / diabetes / hypertension / heart disease / cancer",
      submit: "Submit Quick Form",
      skip: "Keep Chatting",
      required: "Enter at least one key detail before submitting the form.",
    },
    title: "AI Triage Consultation",
    subtitle:
      "Describe your problem in your own words. AI will guide the conversation and recommend a department plus reference hospitals within 2-3 turns.",
    placeholder: "Describe your symptoms here...",
    typing: "AI is reviewing your triage details...",
    requestError:
      "Triage service is temporarily unavailable. Please try again shortly.",
    fallbackReply:
      "Sorry, the triage service is busy right now. Please try again in a moment.",
    completed:
      "Triage is complete. Your department and hospital recommendations are ready.",
    summaryTitle: "Triage Summary",
    summaryDesc: "A structured summary to carry into booking/session creation.",
    summaryEmpty: "Summary will appear after triage is complete.",
    doctorTitle: "Reference Hospitals",
    doctorDesc: "Top 5 hospitals ranked for the suggested department",
    searching: "Preparing routing result...",
    doctorQueryError:
      "Hospital recommendations failed to load. Please retry or refresh this session.",
    noDoctor:
      "No hospital recommendation is available yet. Try adding more specific symptom details.",
    noBio: "No profile details available yet.",
    viewProfile: "View Profile",
    chooseBook: "Choose & Book",
    whatsapp: "Book via WhatsApp",
    startNew: "Start New Session",
    disclaimerTitle: "Medical Disclaimer",
    disclaimerDesc:
      "AI suggestions are for triage and hospital routing only. They are not a diagnosis.",
    disclaimerLine1:
      "Do not share highly sensitive identity details (ID/passport numbers) in chat.",
    disclaimerLine2:
      "If you have severe chest pain, breathing distress, stroke signs, heavy bleeding, or any emergency symptoms, call local emergency services immediately.",
    cancel: "Cancel",
    understand: "I Understand",
    rating: "Rating",
    doctorFallback: "Reference Hospital",
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
    bookingSuccess: "Booking created. Redirecting to checkout...",
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
    bookingDeviceIdMissing:
      "Cannot read device id. Please refresh and try again.",
    initialAssistantMessage:
      "If you are comfortable, please start with your age and gender. Then we can go through 4 quick questions so I can guide you faster: 1. What is the main symptom, and where is it located? 2. How long has it been happening, and did it start suddenly or gradually? 3. Is it related to any recent injury or surgery? 4. Do you have any important underlying conditions, such as diabetes, high blood pressure, heart disease, immune disorders, or cancer? If something does not apply, write \"none\".",
    reasonFallback: "Recommended based on triage details",
    bookingSummaryFallback: "Symptom details shared in AI chat.",
    bookingSymptomsFallback: "Shared in triage chat",
    bookingDurationFallback: "Unspecified",
  },
  zh: {
    common: {
      save: "保存",
      cancel: "取消",
      edit: "编辑",
      select_book: "选择并预约",
      view_profile: "查看详情",
      doctor_placeholder: "医生",
      specialty_unavailable: "暂无专长信息",
      unnamed_patient: "未命名患者",
      no_summary_available: "暂无摘要。",
    },
    triage_card: {
      summary: "问诊摘要",
      possibility: "可能方向",
      recommended_department: "建议就诊专科",
      recommended_hospitals: "参考医院",
      next_step_title: "AI 已完成初步分诊，请选择一家医院继续就诊协助",
      next_step_description:
        "若信息无误，请点击下方医院进入下一步；如需补充信息，请开启新一轮问诊。",
      not_diagnosis: "这份结果只用于分诊和就医路径建议，不构成明确诊断。",
      browse_hospital: "查看服务说明并下单",
      reduced_confidence_title: "当前关键信息不足",
      reduced_confidence_description: (fields: string[]) =>
        `以下为初步分诊建议，建议补充${fields.join("、")}及相关伴随症状以提高准确性。`,
      critical_field_labels: {
        age: "年龄",
        gender: "性别",
      },
      platform_match: "已匹配站内医院",
      manual_coordination: "支持人工协调",
      no_hospitals: "暂未生成参考医院，请补充更多信息后重新开始分诊。",
      possibility_fallback:
        "当前信息更像某一类专科方向，建议线下面诊进一步评估。",
      department_fallback: "相关专科",
    },
    summary_form: {
      title: "AI 整理出的病情总结",
      description:
        "这是我根据对话整理出的结构化病情总结。请检查并修改不准确的地方，再带到下一步就诊。",
      age_gender: "年龄 / 性别",
      main_symptom_and_location: "核心症状与部位",
      duration_and_onset: "发病时间与急缓",
      trauma_or_surgery: "外伤与手术史",
      medical_history: "关键基础疾病",
      other_symptoms: "其他症状",
    },
    interruption: {
      eyebrow: "紧急提醒",
      title: "检测到高风险症状，AI 分诊已停止",
      description:
        "您提供的信息提示可能存在紧急医疗风险。请不要继续在聊天中等待，建议立即前往线下就医。",
      next_steps_title: "建议您现在就做",
      next_steps: [
        "如果症状突然出现、明显加重，或已影响说话、呼吸、意识，请立即联系当地急救服务。",
        "如暂不需要呼叫急救，也请尽快前往最近的急诊或紧急门诊，由线下医生立即评估。",
        "如条件允许，请携带目前用药、过敏史、既往病史以及近期检查结果一同就诊。",
      ],
      primary_cta: "去看医院库",
      secondary_cta: "返回首页",
      footer:
        "此安全中断用于减少潜在急症的等待时间，不建议继续依赖当前聊天获得处置意见。",
    },
    sidebar: {
      new_session: "新会话",
      today: "今天",
      previous_7_days: "过去 7 天",
      older: "更早",
      load_failed: "会话记录加载失败，请刷新后重试。",
      empty: "暂无历史会话。",
      no_messages_in_session: "当前会话暂无消息。",
      read_only_placeholder: "这是历史会话（只读）...",
    },
    status: {
      typing: "AI 正在输入...",
      reviewing: "AI 正在整理分诊信息...",
      thinking: "AI 正在思考...",
      quota_login_required: "游客试用额度已尽，请登录后继续问诊。",
      message_limit_reached:
        "本次会诊已达到消息上限，请尽快查看建议专科和参考医院。",
      message_limit_action: "选择医院继续",
    },
    patientLabel: "患者",
    triage: {
      disclaimer:
        "AI 可能会产生错误信息。在做出医疗决定前，请务必咨询专业医生。",
      post_complete_input_title: "当前主要操作是选择医院继续",
      post_complete_input_description:
        "分诊结果已经生成，建议优先点击上方医院进入下一步；如需补充症状，请开启新一轮问诊。",
    },
    doctor_detail: {
      about: "医生信息",
      biography: "个人简介",
      confirm_book: "确认选择并预约",
      years_experience: (years: number) => `从业 ${years} 年`,
    },
    fast_intake: {
      title: "快捷表单（可选）",
      description:
        "如果不方便聊天，可以改用简表；默认仍然是 AI 在 2-3 轮内主动引导分诊。",
      age: "年龄",
      gender: "性别",
      gender_placeholder: "请选择性别",
      gender_male: "男",
      gender_female: "女",
      gender_other: "其他",
      gender_unknown: "不便说明",
      main_symptom: "核心症状与部位",
      main_symptom_placeholder: "例如：右下腹痛 / 胸闷 / 腿部皮肤破损",
      duration_onset: "发病时间与急缓",
      duration_onset_placeholder:
        "例如：今天早上突然出现 / 3 天来逐渐加重 / 2 个月反复发作",
      trauma_surgery: "外伤与手术史",
      trauma_surgery_placeholder: "例如：无 / 昨天摔伤 / 近期做过手术",
      chronic_conditions: "关键基础疾病",
      chronic_conditions_placeholder:
        "例如：无 / 糖尿病 / 高血压 / 心脏病 / 肿瘤",
      submit: "提交快捷表单",
      skip: "继续聊天",
      required: "请至少填写一项关键信息后再提交表单。",
    },
    title: "AI 预诊分诊",
    subtitle:
      "请先用自己的话描述不适，AI 会在前 2-3 轮内主动引导并完成专科和医院推荐。",
    placeholder: "请在这里描述您的症状...",
    typing: "AI 正在整理分诊信息...",
    requestError: "分诊服务暂时不可用，请稍后重试。",
    fallbackReply: "抱歉，当前分诊服务繁忙。请稍后再试。",
    completed: "分诊已完成，建议专科和参考医院已生成。",
    summaryTitle: "病情摘要",
    summaryDesc: "可直接用于下一步预约/建会话的结构化摘要。",
    summaryEmpty: "尚未完成分诊，摘要会在完成后显示。",
    doctorTitle: "参考医院",
    doctorDesc: "根据建议专科给出前 5 家参考医院",
    searching: "正在整理推荐结果...",
    doctorQueryError: "医院推荐加载失败，请重试或刷新当前会话。",
    noDoctor: "暂未生成参考医院，请补充更具体症状。",
    noBio: "暂无医生简介",
    viewProfile: "查看详情",
    chooseBook: "选择并预约",
    whatsapp: "WhatsApp 预约",
    startNew: "开始新会话",
    disclaimerTitle: "医疗免责声明",
    disclaimerDesc: "AI 建议仅用于分诊与医院/专科路径推荐，不构成医疗诊断。",
    disclaimerLine1: "请勿在对话中发送高敏感身份信息（证件号/护照号等）。",
    disclaimerLine2:
      "如出现胸痛、呼吸困难、中风征象、大出血等急症，请立即联系当地急救服务。",
    cancel: "取消",
    understand: "我已知悉",
    rating: "评分",
    doctorFallback: "参考医院",
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
    bookingSuccess: "预约创建成功，正在跳转支付页。",
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
      "如果方便，请先告诉我年龄和性别。然后我们按 4 个问题来，这样我能更快帮您判断专科和医院：1. 现在最主要的不适是什么，具体在哪个部位？2. 这个症状出现多久了，是突然发生还是逐渐加重/反复发作？3. 这次不适和外伤或近期手术有没有关系？4. 有没有需要特别注意的基础疾病，比如糖尿病、高血压或心脏病、免疫系统疾病或肿瘤？没有可直接写“无”。",
    reasonFallback: "基于分诊信息推荐",
    bookingSummaryFallback: "已在 AI 对话中提供症状描述",
    bookingSymptomsFallback: "已在分诊中描述",
    bookingDurationFallback: "未明确",
  },
} as const;

export const getTriageCopy = (lang: TriageLang) => TRIAGE_COPY[lang];

export const getLocalizedTriageText = (input: {
  lang: TriageLang;
  text?: LocalizedText | null;
  fallback: string;
}) => {
  if (!input.text) {
    return input.fallback;
  }

  return input.text[input.lang] || input.fallback;
};

export const getLocalizedInterruptionDetail = (input: {
  lang: TriageLang;
  message?: LocalizedText | null;
  riskCodes?: string[];
  fallback: string;
}) => {
  if (input.message) {
    return input.message[input.lang];
  }

  for (const code of input.riskCodes ?? []) {
    const localized = INTERRUPTION_DETAIL_BY_RISK_CODE[code];
    if (localized) {
      return localized[input.lang];
    }
  }

  return input.fallback;
};

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
