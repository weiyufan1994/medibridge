export const hospitalsCopy = {
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
} as const;
