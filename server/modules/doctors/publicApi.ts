import * as repo from "./repo";

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
