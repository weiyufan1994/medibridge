import { consumeOtpCode, setSessionCookieByUser } from "./actions";
import { findOrCreateGuestSessionOwnerAction } from "./guestIdentityActions";
import * as repo from "./repo";

export type { GuestSessionOwner } from "./guestIdentityActions";
export type { CookieRequest, CookieResponse, SessionUser } from "./actions";
export type { VerifyMagicLinkInput, VerifyOtpInput } from "./schemas";

export const authAccountApi = {
  consumeOtpCode,
  get findOrCreateFormalUserByEmail() {
    return repo.findOrCreateFormalUserByEmail;
  },
  get getGuestUserByDeviceId() {
    return repo.getGuestUserByDeviceId;
  },
  get getUserById() {
    return repo.getUserById;
  },
  setSessionCookieByUser,
};

export const authGuestIdentityApi = {
  findOrCreateGuestSessionOwner: findOrCreateGuestSessionOwnerAction,
};
