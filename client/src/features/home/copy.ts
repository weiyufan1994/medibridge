export type HomeLang = "en" | "zh";

export const HOME_COPY = {
  en: {
    brandSubtitle: "AI-Powered Medical Bridge to China",
    login: "Sign in / Register",
    dashboard: "My Account",
    admin: "Admin",
    logout: "Sign out",
    logoutSuccess: "Signed out",
    logoutFailed: "Logout failed, please retry.",
    browseHospitals: "Browse Hospitals",
    heroTitle: "Connect with Top Chinese Medical Experts",
    heroDescription:
      "MediBridge uses AI to match you with the best doctors and specialists from Shanghai's premier hospitals. Get expert medical opinions and treatment options in China.",
    startConsultation: "Start Consultation",
    feature1Title: "AI-Powered Matching",
    feature1Description:
      "Our intelligent system analyzes your symptoms and medical needs to recommend the most suitable specialists.",
    feature2Title: "Top Hospitals",
    feature2Description:
      "Access over 1,100 doctors from 6 prestigious Grade-A tertiary hospitals in Shanghai.",
    feature3Title: "Expert Specialists",
    feature3Description:
      "Connect with highly-rated specialists across cardiology, oncology, orthopedics, and more.",
    howItWorks: "How It Works",
    step1Title: "Describe Your Condition",
    step1Description: "Chat with our AI assistant about your symptoms and medical history",
    step2Title: "Get Recommendations",
    step2Description: "Receive personalized doctor recommendations based on your needs",
    step3Title: "Connect with Doctors",
    step3Description: "View detailed profiles and connect with your chosen specialists",
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
    login: "登录/注册",
    dashboard: "个人中心",
    admin: "管理后台",
    logout: "退出登录",
    logoutSuccess: "已退出登录",
    logoutFailed: "退出失败，请重试。",
    browseHospitals: "浏览医院",
    heroTitle: "连接中国顶尖医疗专家",
    heroDescription:
      "MediBridge 使用 AI 为您匹配最合适的医生与专科专家，覆盖上海优质三甲医院，帮助您获得专业医疗建议与治疗方案。",
    startConsultation: "开始问诊",
    feature1Title: "AI 智能匹配",
    feature1Description: "系统会结合您的症状与就医需求，推荐最匹配的专科医生。",
    feature2Title: "顶级医院资源",
    feature2Description: "覆盖上海 6 家知名三甲医院，汇聚 1100+ 医生资源。",
    feature3Title: "专家医生团队",
    feature3Description: "可对接心内科、肿瘤科、骨科等多学科高评分专家。",
    howItWorks: "使用流程",
    step1Title: "描述病情",
    step1Description: "与 AI 助手沟通您的症状、病程和既往病史",
    step2Title: "获取推荐",
    step2Description: "系统根据您的情况提供个性化医生推荐",
    step3Title: "联系医生",
    step3Description: "查看医生详情并发起下一步咨询",
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
