import { findOrCreateGuestSessionOwnerAction } from "./guestIdentityActions";

export type { GuestSessionOwner } from "./guestIdentityActions";

export const authGuestIdentityApi = {
  findOrCreateGuestSessionOwner: findOrCreateGuestSessionOwnerAction,
};
