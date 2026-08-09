import * as repo from "./repo";

export type DoctorDirectoryHospital = {
  id: number;
  name: string;
  nameEn: string | null;
  city: string;
  cityEn: string | null;
};

export type DoctorDirectoryDepartment = {
  id: number;
  name: string;
};

const toDirectoryHospital = (
  hospital: Awaited<ReturnType<typeof repo.getAllHospitals>>[number]
): DoctorDirectoryHospital => ({
  id: hospital.id,
  name: hospital.name,
  nameEn: hospital.nameEn,
  city: hospital.city,
  cityEn: hospital.cityEn,
});

const toDirectoryDepartment = (
  department: Awaited<ReturnType<typeof repo.getDepartmentsByHospital>>[number]
): DoctorDirectoryDepartment => ({
  id: department.id,
  name: department.name,
});

export const doctorDirectoryApi = {
  async getAllHospitals(): Promise<DoctorDirectoryHospital[]> {
    const hospitals = await repo.getAllHospitals();
    return hospitals.map(toDirectoryHospital);
  },
  async getDepartmentsByHospital(
    hospitalId: number
  ): Promise<DoctorDirectoryDepartment[]> {
    const departments = await repo.getDepartmentsByHospital(hospitalId);
    return departments.map(toDirectoryDepartment);
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
