import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { adminOrOpsProcedure, adminProcedure } from "../../../_core/trpc";
import { storagePut } from "../../../storage";
import { aiRepo } from "../../ai/publicApi";
import { appointmentsRepo } from "../../appointments/publicApi";
import {
  doctorsRepo,
  toPublicLocalizedHospital,
} from "../../doctors/publicApi";
import {
  adminHospitalImageClearSchema,
  adminHospitalImageUploadSchema,
  adminOperationAuditInputSchema,
  adminTriageRiskEventsInputSchema,
  adminTriageSessionsInputSchema,
} from "../schemas";
import {
  HOSPITAL_IMAGE_MAX_BYTES,
  HOSPITAL_IMAGE_MIME_TYPES,
  resolveHospitalImageContentType,
  resolveHospitalImageExtension,
  stripDataUrl,
  toDate,
} from "../support";

export const operationProcedures = {
  adminOperationAudit: adminOrOpsProcedure
    .input(adminOperationAuditInputSchema)
    .query(async ({ input }) => {
      return appointmentsRepo.listAppointmentStatusEventsForAdmin({
        page: input.page,
        pageSize: input.pageSize,
        operatorId: input.operatorId,
        actionType: input.actionType,
        from: toDate(input.from),
        to: toDate(input.to),
      });
    }),

  adminHospitals: adminOrOpsProcedure.query(async () => {
    const hospitals = await doctorsRepo.getAllHospitals();
    return hospitals.map(toPublicLocalizedHospital);
  }),

  adminUploadHospitalImage: adminProcedure
    .input(adminHospitalImageUploadSchema)
    .mutation(async ({ input }) => {
      const hospital = await doctorsRepo.getHospitalById(input.hospitalId);
      if (!hospital) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Hospital not found",
        });
      }

      const clean = stripDataUrl(input.imageBase64);
      const contentType = resolveHospitalImageContentType(
        input.contentType || clean.contentType
      );
      if (!HOSPITAL_IMAGE_MIME_TYPES.has(contentType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid image content type",
        });
      }
      const base64Pattern = /^[A-Za-z0-9+/=]+$/;
      if (!base64Pattern.test(clean.value)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid image payload",
        });
      }
      const imageBuffer = Buffer.from(clean.value, "base64");
      if (imageBuffer.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Empty image payload",
        });
      }
      if (imageBuffer.length > HOSPITAL_IMAGE_MAX_BYTES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Image too large",
        });
      }

      const extension = resolveHospitalImageExtension(
        input.fileName,
        contentType
      );
      const storageKey = `hospitals/${input.hospitalId}/${Date.now()}-${randomUUID()}.${extension}`;
      const { url } = await storagePut(storageKey, imageBuffer, contentType);
      await doctorsRepo.setHospitalImageUrl(input.hospitalId, url);

      return {
        hospitalId: hospital.id,
        imageUrl: url,
      } as const;
    }),

  adminClearHospitalImage: adminProcedure
    .input(adminHospitalImageClearSchema)
    .mutation(async ({ input }) => {
      const hospital = await doctorsRepo.getHospitalById(input.hospitalId);
      if (!hospital) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Hospital not found",
        });
      }
      await doctorsRepo.setHospitalImageUrl(input.hospitalId, null);
      return {
        hospitalId: hospital.id,
        imageUrl: null,
      } as const;
    }),

  adminTriageSessions: adminOrOpsProcedure
    .input(adminTriageSessionsInputSchema)
    .query(async ({ input }) => {
      return aiRepo.listAiChatSessionsForAdmin({
        limit: input.limit,
        status: input.status,
        userId: input.userId,
      });
    }),

  adminTriageRiskEvents: adminOrOpsProcedure
    .input(adminTriageRiskEventsInputSchema)
    .query(async ({ input }) => {
      const [events, flags] = await Promise.all([
        aiRepo.listTriageRiskEventsForAdmin(input.limit),
        aiRepo.listLatestKnowledgeFlagsForAdmin(input.limit * 2),
      ]);

      const latestKnowledgeTraceBySessionId = new Map<number, unknown>();
      for (const flag of flags) {
        if (latestKnowledgeTraceBySessionId.has(flag.sessionId)) {
          continue;
        }
        try {
          latestKnowledgeTraceBySessionId.set(
            flag.sessionId,
            JSON.parse(flag.flagValue)
          );
        } catch {
          latestKnowledgeTraceBySessionId.set(flag.sessionId, null);
        }
      }

      return events.map(event => ({
        ...event,
        knowledgeTrace:
          latestKnowledgeTraceBySessionId.get(event.sessionId) ?? null,
      }));
    }),
};
