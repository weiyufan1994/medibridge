import * as authRepo from "./repo";

export type GuestSessionOwner = {
  id: number;
  role: "free" | "pro" | "admin" | "ops";
  isGuest: 1;
};

export async function findOrCreateGuestSessionOwnerAction(
  deviceId: string
): Promise<GuestSessionOwner | undefined> {
  const user = await authRepo.findOrCreateGuestUserByDeviceId(deviceId);
  if (!user) {
    return undefined;
  }

  return {
    id: user.id,
    role: user.role,
    isGuest: 1,
  };
}
