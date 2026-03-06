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
      selectHospitalDescription: (count: number) =>
        `Choose from ${count} premier hospitals in Shanghai`,
      selectDepartmentTitle: "Select a Department",
      doctorsTitle: "Doctors",
      doctorsCountLabel: (departmentName: string, count: number) =>
        `${departmentName} • ${count} doctors`,
      back: "Back",
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
      selectHospitalTitle: "选择医院",
      selectHospitalDescription: (count: number) =>
        `可从上海 ${count} 家重点医院中选择`,
      selectDepartmentTitle: "选择科室",
      doctorsTitle: "医生列表",
      doctorsCountLabel: (departmentName: string, count: number) =>
        `${departmentName} • ${count} 位医生`,
      back: "返回",
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

