import * as repo from "./repo";

export const doctorDirectoryApi = {
  get getAllHospitals() {
    return repo.getAllHospitals;
  },
  get getDepartmentsByHospital() {
    return repo.getDepartmentsByHospital;
  },
};

export const doctorsAdminApi = {
  get getAllHospitals() {
    return repo.getAllHospitals;
  },
  get getDoctorById() {
    return repo.getDoctorById;
  },
  get getHospitalById() {
    return repo.getHospitalById;
  },
  get setHospitalImageUrl() {
    return repo.setHospitalImageUrl;
  },
};
export {
  toLocalizedTextValue,
  toPublicLocalizedHospital,
} from "./presentation";
