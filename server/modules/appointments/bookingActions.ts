import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { z } from "zod";
import * as aiRepo from "../ai/repo";
import * as schedulingRepo from "../scheduling/repo";
import {
  createAppointmentCheckoutFlow,
  resolveCreateInputToStoredEmail,
} from "./checkoutActions";
import { resolveAppointmentPackage } from "./packageCatalog";
import { createInputSchema, createV2InputSchema } from "./schemas";

type CreateInput = z.infer<typeof createInputSchema>;
type CreateV2Input = z.infer<typeof createV2InputSchema>;

export async function prepareCreateCheckout(input: {
  createInput: CreateInput;
  userId?: number;
  userEmail?: string | null;
}) {
  const currentUserEmail = input.userEmail?.trim().toLowerCase();
  if (!currentUserEmail || currentUserEmail !== input.createInput.email) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "请先验证您的邮箱以确认身份",
    });
  }

  const triageSession = await aiRepo.getAiChatSessionById(input.createInput.triageSessionId);
  if (!triageSession || triageSession.userId !== input.userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Invalid triage session for appointment",
    });
  }

  return {
    triageSessionId: input.createInput.triageSessionId,
    appointmentType: input.createInput.appointmentType,
    scheduledAt: input.createInput.scheduledAt,
    email: input.createInput.email,
    sessionId: input.createInput.sessionId,
    selectedPackage: resolveAppointmentPackage({
      appointmentType: input.createInput.appointmentType,
    }),
    intake: input.createInput.intake,
  };
}

export async function prepareCreateV2Checkout(input: {
  createInput: CreateV2Input;
  userId?: number;
  userEmail?: string | null;
}) {
  let triageSessionId = input.createInput.triageSessionId;
  if (!triageSessionId) {
    if (!input.userId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "triageSessionId is required for anonymous booking",
      });
    }
    triageSessionId = await aiRepo.createAiChatSession(input.userId);
  }

  const triageSession = await aiRepo.getAiChatSessionById(triageSessionId);
  if (!triageSession) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Invalid triage session for appointment",
    });
  }
  if (input.userId && triageSession.userId && triageSession.userId !== input.userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Invalid triage session for appointment",
    });
  }

  const email = await resolveCreateInputToStoredEmail({
    email: input.createInput.contact.email,
    phone: input.createInput.contact.phone,
  });
  const sessionEmail = input.userEmail?.trim().toLowerCase();
  if (
    input.createInput.contact.email &&
    sessionEmail &&
    sessionEmail !== input.createInput.contact.email
  ) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "请先验证您的邮箱以确认身份",
    });
  }

  const slot = await schedulingRepo.getSlotById(input.createInput.slotId);
  if (!slot) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Selected slot not found",
    });
  }
  if (slot.doctorId !== input.createInput.doctorId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Slot doctor does not match appointment doctor",
    });
  }

  const appointmentType = input.createInput.appointmentType ?? slot.appointmentType;
  return {
    slotId: slot.id,
    triageSessionId,
    appointmentType,
    scheduledAt: slot.startAt,
    email,
    sessionId: input.createInput.sessionId,
    selectedPackage: resolveAppointmentPackage({
      appointmentType,
      packageId: input.createInput.packageId,
    }),
    intake: input.createInput.intake,
  };
}

export async function createCheckoutFromCreateInput(input: {
  createInput: CreateInput;
  userId?: number;
  userEmail?: string | null;
  req: Request;
}) {
  const prepared = await prepareCreateCheckout({
    createInput: input.createInput,
    userId: input.userId,
    userEmail: input.userEmail,
  });

  return createAppointmentCheckoutFlow({
    doctorId: input.createInput.doctorId,
    triageSessionId: prepared.triageSessionId,
    appointmentType: prepared.appointmentType,
    scheduledAt: prepared.scheduledAt,
    email: prepared.email,
    sessionId: prepared.sessionId,
    userId: input.userId,
    selectedPackage: prepared.selectedPackage,
    intake: prepared.intake,
    req: input.req,
  });
}

export async function createCheckoutFromCreateV2Input(input: {
  createInput: CreateV2Input;
  userId?: number;
  userEmail?: string | null;
  req: Request;
}) {
  const prepared = await prepareCreateV2Checkout({
    createInput: input.createInput,
    userId: input.userId,
    userEmail: input.userEmail,
  });

  return createAppointmentCheckoutFlow({
    slotId: prepared.slotId,
    doctorId: input.createInput.doctorId,
    triageSessionId: prepared.triageSessionId,
    appointmentType: prepared.appointmentType,
    scheduledAt: prepared.scheduledAt,
    email: prepared.email,
    sessionId: prepared.sessionId,
    userId: input.userId,
    selectedPackage: prepared.selectedPackage,
    intake: prepared.intake,
    req: input.req,
  });
}
