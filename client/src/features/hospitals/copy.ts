export type HospitalsLang = "en" | "zh";

const hospitalsCopyByLang = {
  en: {
    pageHeader: {
      subtitle: "Browse Hospitals & Doctors",
      backToHome: "Back to Home",
    },
    browser: {
      breadcrumbHospitals: "Hospitals",
      breadcrumbDepartmentsFallback: "Departments",
      breadcrumbDoctorsFallback: "Doctors",
      selectHospitalTitle: "Select a Hospital",
      selectHospitalIntro:
        "Quickly find top medical institutions by name, tier, or city.",
      selectHospitalDescription: (count: number) =>
        `Choose from ${count} premier hospitals in Shanghai`,
      selectDepartmentTitle: "Select a Department",
      doctorsTitle: "Doctors",
      doctorsCountLabel: (departmentName: string, count: number) =>
        `${departmentName} • ${count} doctors`,
      back: "Back",
      searchHospitalsLabel: "Search hospitals",
      searchHospitalsPlaceholder: "Search hospitals...",
      cityLabel: "City",
      allCities: "All cities",
      noHospitalsFound: "No hospitals found.",
      hospitalCardDescription:
        "A nationally recognized tertiary hospital with strong comprehensive care and specialist services in oral and maxillofacial medicine.",
      viewDoctors: "View Doctors",
      searchPlaceholder: "Search by name or expertise...",
      noDoctorsFound: "No doctors found",
      specialtyLabel: "Specialty: ",
      expertiseLabel: "Expertise: ",
      viewProfile: "View Profile",
    },
    doctorDetail: {
      subtitle: "AI-Powered Medical Bridge to China",
      back: "Back",
      backToHome: "Back to Home",
      notFound: "Doctor not found",
    },
  },
  zh: {
    pageHeader: {
      subtitle: "浏览医院与医生",
      backToHome: "返回首页",
    },
    browser: {
      breadcrumbHospitals: "医院",
      breadcrumbDepartmentsFallback: "科室",
      breadcrumbDoctorsFallback: "医生",
      selectHospitalTitle: "选择合作医院",
      selectHospitalIntro: "支持搜索医院名称、等级与城市，快速找到顶尖医疗机构。",
      selectHospitalDescription: (count: number) =>
        `可从上海 ${count} 家重点医院中选择`,
      selectDepartmentTitle: "选择科室",
      doctorsTitle: "医生列表",
      doctorsCountLabel: (departmentName: string, count: number) =>
        `${departmentName} • ${count} 位医生`,
      back: "返回",
      searchHospitalsLabel: "搜索医院",
      searchHospitalsPlaceholder: "搜索医院...",
      cityLabel: "城市",
      allCities: "全部城市",
      noHospitalsFound: "未找到医院。",
      hospitalCardDescription:
        "全国知名的综合性三甲医院，特色科室包含整形外科、口腔科、骨科等，具备完整的检查与术后随访体系。",
      viewDoctors: "查看医生",
      searchPlaceholder: "按姓名或擅长方向搜索...",
      noDoctorsFound: "未找到医生",
      specialtyLabel: "专科：",
      expertiseLabel: "擅长：",
      viewProfile: "查看详情",
    },
    doctorDetail: {
      subtitle: "AI 驱动的中外医疗桥梁",
      back: "返回",
      backToHome: "返回首页",
      notFound: "未找到医生",
    },
  },
} as const;

export function getHospitalsCopy(lang: HospitalsLang) {
  return hospitalsCopyByLang[lang];
}
