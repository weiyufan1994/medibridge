import * as slotLifecycleActions from "./slotLifecycleActions";

export const schedulingSlotApi = {
  getSlotById: slotLifecycleActions.getSlotById,
  holdSlot: slotLifecycleActions.holdSlot,
  attachHeldSlotToAppointment: slotLifecycleActions.attachHeldSlotToAppointment,
  releaseHeldSlotByAppointmentId:
    slotLifecycleActions.releaseHeldSlotByAppointmentId,
  bookHeldSlotByAppointmentId: slotLifecycleActions.bookHeldSlotByAppointmentId,
};

export const schedulingAdminApi = {
  get releaseHeldSlotByAppointmentId() {
    return slotLifecycleActions.releaseHeldSlotByAppointmentId;
  },
};
