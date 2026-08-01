export type HomeLang = "en" | "zh";

export const HOME_COPY = {
  en: {
    brandSubtitle: "AI-Powered Medical Bridge to China",
    brandHomeLabel: "MediBridge home",
    accountMenuLabel: "Open account menu",
    login: "Sign in / Register",
    dashboard: "My Account",
    admin: "Admin",
    logout: "Sign out",
    logoutSuccess: "Signed out",
    logoutFailed: "Logout failed, please retry.",
    browseHospitals: "Start Hospital Referral",
    heroTitle: "Find the Right Hospital Path in China",
    heroDescription:
      "MediBridge uses AI triage to rank suitable hospitals, then a platform coordinator helps with registration and online consultation scheduling.",
    startConsultation: "Start AI Triage",
    feature1Title: "AI-Powered Matching",
    feature1Description:
      "Our intelligent system organizes your symptoms and suggests the most suitable department.",
    feature2Title: "Top Hospitals",
    feature2Description:
      "Review ranked hospital options based on your triage result and care needs.",
    feature3Title: "Platform Coordination",
    feature3Description:
      "A MediBridge coordinator helps contact the hospital, assist with registration, and arrange an online consultation time.",
    howItWorks: "How It Works",
    step1Title: "Describe Your Condition",
    step1Description:
      "Chat with our AI assistant about your symptoms and medical history",
    step2Title: "Get Recommendations",
    step2Description: "Review ranked hospitals and choose where to continue",
    step3Title: "Coordinate the Referral",
    step3Description:
      "Choose a MediBridge coordinator and track registration and scheduling",
    tryAsking: "Try asking about:",
    tag1: "Heart Problems",
    tag2: "Cancer Screening",
    tag3: "Joint Pain",
    tag4: "Neurological Issues",
    disclaimerTitle: "Medical Disclaimer",
    disclaimerDescription:
      "AI recommendations are only for triage and doctor matching. They are not a diagnosis and do not replace professional medical care.",
    disclaimerLine1:
      "Do not share highly sensitive identity details (ID/passport numbers) in chat.",
    disclaimerLine2:
      "If you have severe chest pain, breathing distress, stroke signs, heavy bleeding, or other emergencies, call local emergency services immediately.",
    cancel: "Cancel",
    understand: "I Understand",
  },
  zh: {
    brandSubtitle: "AI 驱动的中外医疗桥梁",
    brandHomeLabel: "返回 MediBridge 首页",
    accountMenuLabel: "打开账户菜单",
    login: "登录/注册",
    dashboard: "个人中心",
    admin: "管理后台",
    logout: "退出登录",
    logoutSuccess: "已退出登录",
    logoutFailed: "退出失败，请重试。",
    browseHospitals: "开始医院转诊",
    heroTitle: "找到更合适的中国就医路径",
    heroDescription:
      "MediBridge 通过 AI 分诊给出医院排序，再由平台协调专员协助挂号并协调线上面诊时间。",
    startConsultation: "开始 AI 分诊",
    feature1Title: "AI 智能匹配",
    feature1Description: "系统会整理您的症状与就医需求，给出更合适的专科方向。",
    feature2Title: "顶级医院资源",
    feature2Description: "根据分诊结果与就医需求，查看排序后的参考医院。",
    feature3Title: "平台协调服务",
    feature3Description:
      "由 MediBridge 协调专员协助联系医院、推进挂号并协调线上面诊时间。",
    howItWorks: "使用流程",
    step1Title: "描述病情",
    step1Description: "与 AI 助手沟通您的症状、病程和既往病史",
    step2Title: "获取推荐",
    step2Description: "查看医院排序，并选择希望继续对接的医院",
    step3Title: "协调转诊",
    step3Description: "选择 MediBridge 协调专员并跟踪挂号与排期进展",
    tryAsking: "你可以先这样提问：",
    tag1: "心脏不适",
    tag2: "癌症筛查",
    tag3: "关节疼痛",
    tag4: "神经系统问题",
    disclaimerTitle: "医疗免责声明",
    disclaimerDescription:
      "AI 建议仅用于分诊和医生匹配，不构成医疗诊断，也不能替代专业医疗服务。",
    disclaimerLine1: "请勿在对话中提供高敏感身份信息（如身份证号/护照号）。",
    disclaimerLine2:
      "如出现胸痛、呼吸困难、中风征象、大出血等紧急情况，请立即联系当地急救服务。",
    cancel: "取消",
    understand: "我已知悉",
  },
} as const;

export const getHomeCopy = (lang: HomeLang) => HOME_COPY[lang];
