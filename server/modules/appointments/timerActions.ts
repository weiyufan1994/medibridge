import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { validateAppointmentToken } from "./accessValidation";
import {
  applyConsultationFreeExtensionToNotes,
  FREE_EXTENSION_MINUTES,
} from "./consultationTimer";
import * as appointmentsRepo from "./repo";

export async function extendConsultationByDoctorTokenFlow(input: {
  appointmentId: number;
  token: string;
  extensionMinutes: number;
  req?: Request;
}) {
  const validated = await validateAppointmentToken(
    input.appointmentId,
    input.token,
    "read_history",
    input.req
  );
  if (validated.role !== "doctor") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "ONLY_DOCTOR_CAN_EXTEND_CONSULTATION",
    });
  }

  if (input.extensionMinutes !== FREE_EXTENSION_MINUTES) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "INVALID_CONSULTATION_EXTENSION_MINUTES",
    });
  }

  const appointmentId = validated.appointment.id;
  let expectedNotes = validated.appointment.notes ?? null;
  let currentStatus = validated.appointment.status;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const extendResult = applyConsultationFreeExtensionToNotes({
      notes: expectedNotes,
      extensionMinutes: input.extensionMinutes,
    });

    if (!extendResult.ok) {
      if (extendResult.reason === "already_used") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "CONSULTATION_EXTENSION_ALREADY_USED",
        });
      }
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "INVALID_CONSULTATION_EXTENSION_MINUTES",
      });
    }

    const affectedRows = await appointmentsRepo.updateAppointmentNotesIfMatch({
      appointmentId,
      expectedNotes,
      nextNotes: extendResult.nextNotes,
    });
    if (affectedRows === 1) {
      await appointmentsRepo.insertStatusEvent({
        appointmentId,
        fromStatus: currentStatus,
        toStatus: currentStatus,
        operatorType: "doctor",
        reason: "doctor_extended_consultation_timer",
        payloadJson: {
          extensionMinutes: input.extensionMinutes,
          baseDurationMinutes: extendResult.timer.baseDurationMinutes,
          totalDurationMinutes: extendResult.timer.totalDurationMinutes,
        },
      });

      return {
        appointmentId,
        baseDurationMinutes: extendResult.timer.baseDurationMinutes,
        extensionMinutes: extendResult.timer.extensionMinutes,
        totalDurationMinutes: extendResult.timer.totalDurationMinutes,
      };
    }

    const refreshed = await appointmentsRepo.getAppointmentById(appointmentId);
    if (!refreshed) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Appointment not found",
      });
    }
    expectedNotes = refreshed.notes ?? null;
    currentStatus = refreshed.status;
  }

  throw new TRPCError({
    code: "CONFLICT",
    message: "CONSULTATION_EXTENSION_CONFLICT",
  });
}
