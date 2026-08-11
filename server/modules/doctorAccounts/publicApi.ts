import { resolveBoundDoctorIdForUser } from "./accessActions";
import * as repo from "./repo";

export type { ResolveBoundDoctorIdInput } from "./accessActions";

export const doctorAccountAccessApi = {
  get getActiveBindingByUserId() {
    return repo.getActiveBindingByUserId;
  },
  resolveBoundDoctorIdForUser,
};
