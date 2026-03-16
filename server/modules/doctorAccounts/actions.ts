import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { getPublicBaseUrl } from "../../_core/getPublicBaseUrl";
import { sendDoctorInviteEmail } from "../../_core/mailer";
import { getDb } from "../../db";
import * as repo from "./repo";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildInviteToken() {
  return crypto.randomBytes(24).toString("hex");
}

function buildClaimUrl(token: string, req?: Request) {
  const baseUrl = getPublicBaseUrl(req);
  return `${baseUrl}/doctor/claim?token=${encodeURIComponent(token)}`;
}

function assertAuthenticatedEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Please log in with the invited email before claiming the workbench invite",
    });
  }
  return normalized;
}

function assertBinding<T>(value: T | null, message: string) {
  if (!value) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message,
    });
  }
  return value;
}

function serializeBinding(binding: NonNullable<Awaited<ReturnType<typeof repo.getActiveBindingByUserId>>>) {
  return {
    doctorId: binding.doctorId,
    userId: binding.userId,
    email: binding.email,
    status: binding.status,
    boundAt: binding.boundAt ?? null,
    revokedAt: binding.revokedAt ?? null,
  };
}

function serializeInvite(invite: NonNullable<Awaited<ReturnType<typeof repo.getInviteById>>>) {
  return {
    id: invite.id,
    doctorId: invite.doctorId,
    email: invite.email,
    status: invite.status,
    expiresAt: invite.expiresAt,
    sentAt: invite.sentAt ?? null,
    acceptedAt: invite.acceptedAt ?? null,
  };
}

export async function getMyDoctorBinding(userId: number) {
  const activeBinding = await repo.getActiveBindingByUserId(userId);
  return {
    activeBinding: activeBinding ? serializeBinding(activeBinding) : null,
  };
}

export async function getDoctorAccountStatus(doctorId: number) {
  const status = await repo.getDoctorAccountStatusByDoctorId(doctorId);
  return {
    doctorId,
    activeBinding: status.activeBinding ? serializeBinding(status.activeBinding) : null,
    latestInvite: status.latestInvite ? serializeInvite(status.latestInvite) : null,
  };
}

export async function inviteDoctorAccount(input: {
  doctorId: number;
  email: string;
  createdByUserId: number;
  req?: Request;
}) {
  const token = buildInviteToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const now = new Date();

  const existingBinding = await repo.getActiveBindingByDoctorId(input.doctorId);
  if (existingBinding && existingBinding.email !== input.email) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Doctor already has an active workbench binding",
    });
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const invite = await db.transaction(async tx => {
    const openInvite = await repo.getLatestOpenInviteByDoctorAndEmail(
      {
        doctorId: input.doctorId,
        email: input.email,
        now,
      },
      tx
    );

    await repo.clearPendingBindingsByDoctorId(input.doctorId, tx);

    if (openInvite) {
      return repo.updateInviteById(
        openInvite.id,
        {
          email: input.email,
          tokenHash,
          status: "sent",
          expiresAt,
          sentAt: now,
          createdByUserId: input.createdByUserId,
        },
        tx
      );
    }

    return repo.createInvite(
      {
        doctorId: input.doctorId,
        email: input.email,
        tokenHash,
        status: "sent",
        expiresAt,
        sentAt: now,
        createdByUserId: input.createdByUserId,
      },
      tx
    );
  });

  const createdInvite = assertBinding(invite, "Failed to create doctor invite");
  const claimUrl = buildClaimUrl(token, input.req);
  await sendDoctorInviteEmail(input.email, claimUrl, {
    expiresAt,
  });

  return {
    invite: serializeInvite(createdInvite),
    claimUrl,
  };
}

export async function resendDoctorInvite(input: {
  inviteId: number;
  actorUserId: number;
  req?: Request;
}) {
  const invite = assertBinding(await repo.getInviteById(input.inviteId), "Invite not found");
  if (!["pending", "sent"].includes(invite.status)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only pending or sent invites can be resent",
    });
  }

  return inviteDoctorAccount({
    doctorId: invite.doctorId,
    email: invite.email,
    createdByUserId: input.actorUserId,
    req: input.req,
  });
}

export async function cancelDoctorInvite(input: {
  inviteId: number;
}) {
  const affected = await repo.cancelInviteById(input.inviteId);
  if (affected !== 1) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invite not found or already closed",
    });
  }
  return { ok: true as const };
}

export async function revokeDoctorBinding(input: {
  doctorId: number;
  actorUserId: number;
}) {
  const revoked = await repo.revokeActiveBindingByDoctorId({
    doctorId: input.doctorId,
    updatedByUserId: input.actorUserId,
  });
  if (!revoked) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Active doctor binding not found",
    });
  }
  return { ok: true as const };
}

export async function claimDoctorInvite(input: {
  token: string;
  userId: number;
  userEmail: string | null | undefined;
}) {
  const normalizedEmail = assertAuthenticatedEmail(input.userEmail);
  const invite = assertBinding(
    await repo.getInviteByTokenHash(hashToken(input.token)),
    "Doctor invite not found"
  );
  const currentInvite = await repo.expireInviteIfNeeded(invite);

  if (!currentInvite || currentInvite.status === "expired") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Doctor invite has expired",
    });
  }
  if (currentInvite.status === "canceled") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Doctor invite has been canceled",
    });
  }
  if (currentInvite.status === "accepted") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Doctor invite has already been used",
    });
  }
  if (currentInvite.email !== normalizedEmail) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Please sign in with the invited email before claiming this workbench invite",
    });
  }

  const doctorActiveBinding = await repo.getActiveBindingByDoctorId(currentInvite.doctorId);
  if (doctorActiveBinding && doctorActiveBinding.userId !== input.userId) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This doctor already has another active workbench binding",
    });
  }

  const userActiveBinding = await repo.getActiveBindingByUserId(input.userId);
  if (userActiveBinding && userActiveBinding.doctorId !== currentInvite.doctorId) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This account is already bound to another doctor",
    });
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const acceptedAt = new Date();
  const binding = await db.transaction(async tx => {
    await repo.markInviteAccepted(
      {
        inviteId: currentInvite.id,
        claimedByUserId: input.userId,
        acceptedAt,
        dbExecutor: tx,
      }
    );

    if (userActiveBinding) {
      return repo.updateBindingById(
        userActiveBinding.id,
        {
          doctorId: currentInvite.doctorId,
          email: normalizedEmail,
          status: "active",
          boundAt: acceptedAt,
          revokedAt: null,
          updatedByUserId: input.userId,
        },
        tx
      );
    }

    return repo.createBinding(
      {
        doctorId: currentInvite.doctorId,
        userId: input.userId,
        email: normalizedEmail,
        status: "active",
        boundAt: acceptedAt,
        revokedAt: null,
        createdByUserId: currentInvite.createdByUserId ?? input.userId,
        updatedByUserId: input.userId,
      },
      tx
    );
  });

  const activeBinding = assertBinding(binding, "Failed to activate doctor workbench binding");

  return {
    success: true as const,
    binding: serializeBinding(activeBinding),
  };
}

export async function resolveBoundDoctorIdForUser(input: {
  userId: number;
  allowAdminDoctorId?: number;
  userRole?: string | null;
}) {
  const role = String(input.userRole ?? "");
  if ((role === "admin" || role === "ops") && input.allowAdminDoctorId) {
    return input.allowAdminDoctorId;
  }

  const binding = await repo.getActiveBindingByUserId(input.userId);
  if (!binding) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Doctor workbench is not enabled for the current account",
    });
  }
  return binding.doctorId;
}
