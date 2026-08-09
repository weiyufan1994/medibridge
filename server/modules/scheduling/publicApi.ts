import * as repo from "./repo";

export const schedulingAdminApi = {
  get releaseHeldSlotByAppointmentId() {
    return repo.releaseHeldSlotByAppointmentId;
  },
};
