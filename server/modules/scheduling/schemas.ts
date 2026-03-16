import { z } from "zod";
import { APPOINTMENT_TYPE_VALUES } from "../appointments/packageCatalog";
import {
  SCHEDULE_ACTOR_ROLE_VALUES,
  SCHEDULE_EXCEPTION_ACTION_VALUES,
  SLOT_SOURCE_VALUES,
  SLOT_STATUS_VALUES,
} from "./constants";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const hhmmPattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const isoDateSchema = z.string().regex(isoDatePattern, "Invalid date");
const localTimeSchema = z.string().regex(hhmmPattern, "Invalid local time");

export const listAvailableSlotsInputSchema = z.object({
  doctorId: z.number().int().positive(),
  appointmentType: z.enum(APPOINTMENT_TYPE_VALUES).optional(),
});

export const slotOutputSchema = z.object({
  id: z.number().int().positive(),
  doctorId: z.number().int().positive(),
  appointmentType: z.enum(APPOINTMENT_TYPE_VALUES),
  slotDurationMinutes: z.number().int().positive(),
  timezone: z.string().min(1),
  localDate: isoDateSchema,
  startAt: z.date(),
  endAt: z.date(),
  status: z.enum(SLOT_STATUS_VALUES),
  source: z.enum(SLOT_SOURCE_VALUES),
});

export const listAvailableSlotsOutputSchema = z.array(slotOutputSchema);

export const createScheduleRuleInputSchema = z.object({
  doctorId: z.number().int().positive(),
  timezone: z.string().trim().min(1).max(64),
  weekday: z.number().int().min(0).max(6),
  startLocalTime: localTimeSchema,
  endLocalTime: localTimeSchema,
  slotDurationMinutes: z.number().int().positive(),
  appointmentTypeScope: z.enum(APPOINTMENT_TYPE_VALUES),
  validFrom: isoDateSchema.optional(),
  validTo: isoDateSchema.optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateScheduleRuleInputSchema = createScheduleRuleInputSchema.partial().extend({
  id: z.number().int().positive(),
});

export const deleteScheduleRuleInputSchema = z.object({
  id: z.number().int().positive(),
});

export const listScheduleRulesInputSchema = z.object({
  doctorId: z.number().int().positive().optional(),
});

export const scheduleRuleOutputSchema = z.object({
  id: z.number().int().positive(),
  doctorId: z.number().int().positive(),
  timezone: z.string(),
  weekday: z.number().int().min(0).max(6),
  startLocalTime: localTimeSchema,
  endLocalTime: localTimeSchema,
  slotDurationMinutes: z.number().int().positive(),
  appointmentTypeScope: z.enum(APPOINTMENT_TYPE_VALUES),
  validFrom: isoDateSchema.nullable(),
  validTo: isoDateSchema.nullable(),
  isActive: z.boolean(),
  createdByRole: z.enum(SCHEDULE_ACTOR_ROLE_VALUES),
  createdByUserId: z.number().int().positive().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const listScheduleRulesOutputSchema = z.array(scheduleRuleOutputSchema);

export const createScheduleExceptionInputSchema = z.object({
  doctorId: z.number().int().positive(),
  dateLocal: isoDateSchema,
  action: z.enum(SCHEDULE_EXCEPTION_ACTION_VALUES),
  startLocalTime: localTimeSchema.optional(),
  endLocalTime: localTimeSchema.optional(),
  reason: z.string().trim().min(1).max(200).optional(),
});

export const updateScheduleExceptionInputSchema = createScheduleExceptionInputSchema
  .partial()
  .extend({
    id: z.number().int().positive(),
  });

export const deleteScheduleExceptionInputSchema = z.object({
  id: z.number().int().positive(),
});

export const scheduleExceptionOutputSchema = z.object({
  id: z.number().int().positive(),
  doctorId: z.number().int().positive(),
  dateLocal: isoDateSchema,
  action: z.enum(SCHEDULE_EXCEPTION_ACTION_VALUES),
  startLocalTime: localTimeSchema.nullable(),
  endLocalTime: localTimeSchema.nullable(),
  reason: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const listScheduleExceptionsInputSchema = z.object({
  doctorId: z.number().int().positive().optional(),
  dateLocal: isoDateSchema.optional(),
});

export const listScheduleExceptionsOutputSchema = z.array(scheduleExceptionOutputSchema);

export const createManualSlotInputSchema = z.object({
  doctorId: z.number().int().positive(),
  appointmentType: z.enum(APPOINTMENT_TYPE_VALUES),
  slotDurationMinutes: z.number().int().positive(),
  timezone: z.string().trim().min(1).max(64),
  startAt: z.union([z.string().datetime(), z.date()]).transform(value =>
    value instanceof Date ? value : new Date(value)
  ),
  source: z.literal("manual").optional().default("manual"),
});

export const bulkCreateManualSlotsInputSchema = z.object({
  slots: z.array(createManualSlotInputSchema).min(1).max(200),
});

export const generateDoctorSlotsInputSchema = z.object({
  doctorId: z.number().int().positive(),
});

export const listDoctorUpcomingSlotsInputSchema = z.object({
  doctorId: z.number().int().positive().optional(),
});
