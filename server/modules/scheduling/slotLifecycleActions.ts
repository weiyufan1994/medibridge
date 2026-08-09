import * as repo from "./repo";

export function getSlotById(slotId: number) {
  return repo.getSlotById(slotId);
}

export function holdSlot(input: Parameters<typeof repo.holdSlot>[0]) {
  return repo.holdSlot(input);
}

export function attachHeldSlotToAppointment(
  input: Parameters<typeof repo.attachHeldSlotToAppointment>[0]
) {
  return repo.attachHeldSlotToAppointment(input);
}

export function releaseHeldSlotByAppointmentId(
  input: Parameters<typeof repo.releaseHeldSlotByAppointmentId>[0]
) {
  return repo.releaseHeldSlotByAppointmentId(input);
}

export function bookHeldSlotByAppointmentId(
  input: Parameters<typeof repo.bookHeldSlotByAppointmentId>[0]
) {
  return repo.bookHeldSlotByAppointmentId(input);
}
