import { TRPCError } from "@trpc/server";
import type { User } from "../../../drizzle/schema";
import type { ReferralActorType } from "../../../shared/referrals";
import * as referralRepo from "./repo";

export function requireUser(user: User | null) {
  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Please sign in to continue.",
    });
  }

  return user;
}

export function requireFormalUser(user: User | null) {
  const currentUser = requireUser(user);
  if (currentUser.isGuest === 1) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "FORMAL_ACCOUNT_REQUIRED",
    });
  }

  return currentUser;
}

export function resolveActorTypeFromUser(user: User): ReferralActorType {
  return user.role === "ops" ? "ops" : "admin";
}

export async function getOwnedOrder(input: {
  orderId: number;
  userId: number;
}) {
  const order = await referralRepo.getReferralOrderById(input.orderId);
  if (!order || !referralRepo.isOrderOwnedByUser(order, input.userId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Referral order not found",
    });
  }

  return order;
}
