import { z } from "zod";
import {
  APPOINTMENT_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
} from "../appointments/stateMachine";

const paymentStatusSchema = z.enum(PAYMENT_STATUS_VALUES);
const statusSchema = z.enum(APPOINTMENT_STATUS_VALUES);

export const getStatusInputSchema = z.object({
  appointmentId: z.number().int().positive(),
});

export const getStatusOutputSchema = z.object({
  appointmentId: z.number().int().positive(),
  status: statusSchema,
  paymentStatus: paymentStatusSchema,
  paidAt: z.date().nullable(),
  stripeSessionId: z.string().nullable(),
});

export const confirmMockInputSchema = z.object({
  stripeSessionId: z.string().min(8).max(255),
});

export const confirmMockByAppointmentInputSchema = z.object({
  appointmentId: z.number().int().positive(),
});

export const createCheckoutSessionForAppointmentInputSchema = z.object({
  appointmentId: z.number().int().positive(),
});

export const getCheckoutResultInputSchema = z.object({
  stripeSessionId: z.string().trim().min(1).max(255),
});

export const getCheckoutResultOutputSchema = z.object({
  appointmentId: z.number().int().positive(),
  paymentStatus: paymentStatusSchema,
  status: statusSchema,
  email: z.string(),
  lastAccessAt: z.string().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  canResendLink: z.boolean(),
  messageForUser: z.string(),
});

export const createCheckoutSessionForAppointmentOutputSchema = z.object({
  appointmentId: z.number().int().positive(),
  checkoutSessionUrl: z.string().url(),
  status: statusSchema,
  paymentStatus: paymentStatusSchema,
  stripeSessionId: z.string().optional(),
});

export const confirmMockOutputSchema = z.object({
  ok: z.literal(true),
  alreadySettled: z.boolean(),
  appointmentId: z.number().int().positive(),
  devPatientLink: z.string().url().nullable(),
  devDoctorLink: z.string().url().nullable(),
});

export const confirmMockByAppointmentOutputSchema = z.object({
  ok: z.literal(true),
  alreadySettled: z.boolean(),
  appointmentId: z.number().int().positive(),
  stripeSessionId: z.string().nullable(),
  devPatientLink: z.string().url().nullable(),
  devDoctorLink: z.string().url().nullable(),
});
