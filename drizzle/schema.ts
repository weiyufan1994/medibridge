import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  float,
  json,
  index,
  uniqueIndex,
  tinyint,
} from "drizzle-orm/mysql-core";
import { z } from "zod";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  isGuest: tinyint("isGuest").notNull().default(1),
  deviceId: varchar("deviceId", { length: 128 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["free", "pro", "admin"]).default("free").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Hospitals table - stores information about medical institutions
 */
export const hospitals = mysqlTable("hospitals", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }),
  city: varchar("city", { length: 100 }).notNull().default("上海"),
  cityEn: varchar("cityEn", { length: 100 }),
  level: varchar("level", { length: 50 }).default("三级甲等"),
  levelEn: varchar("levelEn", { length: 50 }),
  address: text("address"),
  addressEn: text("addressEn"),
  contact: varchar("contact", { length: 100 }),
  website: varchar("website", { length: 255 }),
  description: text("description"),
  descriptionEn: text("descriptionEn"),
  imageUrl: varchar("imageUrl", { length: 500 }),
  sourceHash: varchar("sourceHash", { length: 64 }),
  translationStatus: mysqlEnum("translationStatus", [
    "pending",
    "done",
    "failed",
  ]).default("pending"),
  translatedAt: timestamp("translatedAt"),
  lastTranslationError: text("lastTranslationError"),
  translationProvider: varchar("translationProvider", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  }, table => ({
    translationStatusIdx: index("hospitalsTranslationStatusIdx").on(table.translationStatus),
    translationStatusIdIdx: index("hospitalsTranslationStatusIdIdx").on(
      table.translationStatus,
      table.id
    ),
  }));

export type Hospital = typeof hospitals.$inferSelect;
export type InsertHospital = typeof hospitals.$inferInsert;

/**
 * Departments table - stores hospital departments/specialties
 */
export const departments = mysqlTable(
  "departments",
  {
    id: int("id").autoincrement().primaryKey(),
    hospitalId: int("hospitalId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    nameEn: varchar("nameEn", { length: 255 }),
    description: text("description"),
  descriptionEn: text("descriptionEn"),
  url: varchar("url", { length: 1024 }),
  sourceHash: varchar("sourceHash", { length: 64 }),
  translationStatus: mysqlEnum("translationStatus", [
    "pending",
    "done",
      "failed",
    ]).default("pending"),
    translatedAt: timestamp("translatedAt"),
    lastTranslationError: text("lastTranslationError"),
    translationProvider: varchar("translationProvider", { length: 100 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    hospitalIdx: index("hospitalIdx").on(table.hospitalId),
    translationStatusIdx: index("departmentsTranslationStatusIdx").on(table.translationStatus),
    translationStatusIdIdx: index("departmentsTranslationStatusIdIdx").on(
      table.translationStatus,
      table.id
    ),
  })
);

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;

/**
 * Doctors table - stores doctor information
 */
export const doctors = mysqlTable(
  "doctors",
  {
    id: int("id").autoincrement().primaryKey(),
    hospitalId: int("hospitalId").notNull(),
    departmentId: int("departmentId").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    nameEn: varchar("nameEn", { length: 100 }),
    title: varchar("title", { length: 100 }),
    titleEn: varchar("titleEn", { length: 100 }),
    specialty: text("specialty"),
    experience: text("experience"),
    description: text("description"),
    imageUrl: varchar("imageUrl", { length: 500 }),
    specialtyEn: text("specialtyEn"),
    expertise: text("expertise"),
    expertiseEn: text("expertiseEn"),
    sourceDoctorId: varchar("sourceDoctorId", { length: 128 }),
    websiteUrl: varchar("websiteUrl", { length: 500 }),
    haodafUrl: varchar("haodafUrl", { length: 500 }),
    totalPatients: varchar("totalPatients", { length: 100 }),
    totalArticles: varchar("totalArticles", { length: 100 }),
    totalVisits: varchar("totalVisits", { length: 100 }),
    scrapedDate: varchar("scrapedDate", { length: 100 }),
    scrapedStatus: varchar("scrapedStatus", { length: 64 }),
    dataSource: varchar("dataSource", { length: 255 }),
    educationExperience: text("educationExperience"),
    socialRole: text("socialRole"),
    researchAchievements: text("researchAchievements"),
    honors: text("honors"),
    followUpPatients: varchar("followUpPatients", { length: 100 }),
    followUpFeedback: text("followUpFeedback"),
    gender: varchar("gender", { length: 20 }),
    sequenceNumber: int("sequenceNumber"),
    satisfactionRate: text("satisfactionRate"),
    satisfactionRateEn: text("satisfactionRateEn"),
    attitudeScore: text("attitudeScore"),
    attitudeScoreEn: text("attitudeScoreEn"),
    recommendationScore: float("recommendationScore"),
    onlineConsultation: varchar("onlineConsultation", { length: 50 }),
    onlineConsultationEn: varchar("onlineConsultationEn", { length: 50 }),
    appointmentAvailable: text("appointmentAvailable"),
    appointmentAvailableEn: text("appointmentAvailableEn"),
    sourceHash: varchar("sourceHash", { length: 64 }),
    translationStatus: mysqlEnum("translationStatus", [
      "pending",
      "done",
      "failed",
    ]).default("pending"),
    translatedAt: timestamp("translatedAt"),
    lastTranslationError: text("lastTranslationError"),
    translationProvider: varchar("translationProvider", { length: 100 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    hospitalIdx: index("hospitalIdx").on(table.hospitalId),
    departmentIdx: index("departmentIdx").on(table.departmentId),
    recommendationIdx: index("recommendationIdx").on(table.recommendationScore),
    translationStatusIdx: index("doctorsTranslationStatusIdx").on(table.translationStatus),
    translationStatusIdIdx: index("doctorsTranslationStatusIdIdx").on(
      table.translationStatus,
      table.id
    ),
    hospitalDepartmentNameUk: uniqueIndex("doctorHospitalDepartmentNameUk").on(
      table.hospitalId,
      table.departmentId,
      table.name
    ),
  })
);

export type Doctor = typeof doctors.$inferSelect;
export type InsertDoctor = typeof doctors.$inferInsert;

/**
 * Doctor embeddings table - stores vector embeddings for RAG
 */
export const doctorEmbeddings = mysqlTable(
  "doctorEmbeddings",
  {
    id: int("id").autoincrement().primaryKey(),
    doctorId: int("doctorId").notNull().unique(),
    embedding: json("embedding").notNull(), // Store as JSON array
    content: text("content").notNull(), // Original text used for embedding
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    doctorIdx: index("doctorIdx").on(table.doctorId),
  })
);

export type DoctorEmbedding = typeof doctorEmbeddings.$inferSelect;
export type InsertDoctorEmbedding = typeof doctorEmbeddings.$inferInsert;

/**
 * Patient sessions table - stores chat history and recommendations
 */
export const patientSessions = mysqlTable(
  "patientSessions",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
    userId: int("userId").references(() => users.id, { onDelete: "set null" }),
    chatHistory: json("chatHistory").notNull(), // Array of messages
    symptoms: text("symptoms"),
    duration: varchar("duration", { length: 100 }),
    age: int("age"),
    medicalHistory: text("medicalHistory"),
    recommendedDoctors: json("recommendedDoctors"), // Array of doctor IDs with reasons
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    sessionIdx: index("sessionIdx").on(table.sessionId),
    userIdx: index("userIdx").on(table.userId),
  })
);

export type PatientSession = typeof patientSessions.$inferSelect;
export type InsertPatientSession = typeof patientSessions.$inferInsert;

/**
 * AI chat sessions table - stores one complete triage consultation session.
 */
export const aiChatSessions = mysqlTable(
  "ai_chat_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").references(() => users.id, { onDelete: "set null" }),
    status: mysqlEnum("status", ["active", "completed"])
      .default("active")
      .notNull(),
    summary: text("summary"),
    summaryGeneratedAt: timestamp("summaryGeneratedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userIdx: index("aiChatSessionsUserIdx").on(table.userId),
    statusIdx: index("aiChatSessionsStatusIdx").on(table.status),
  })
);

export type AiChatSession = typeof aiChatSessions.$inferSelect;
export type InsertAiChatSession = typeof aiChatSessions.$inferInsert;

export const aiConsultationSessionStatusSchema = z.enum(["active", "completed"]);
export const aiConsultationSessionSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive().nullable(),
  title: z.string().trim().min(1).max(255),
  status: aiConsultationSessionStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type AiConsultationSession = z.infer<typeof aiConsultationSessionSchema>;

/**
 * AI chat messages table - stores every message inside one triage session.
 */
export const aiChatMessages = mysqlTable(
  "ai_chat_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: int("sessionId")
      .notNull()
      .references(() => aiChatSessions.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["user", "assistant"]).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    sessionIdx: index("aiChatMessagesSessionIdx").on(table.sessionId),
    createdAtIdx: index("aiChatMessagesCreatedAtIdx").on(table.createdAt),
  })
);

export type AiChatMessage = typeof aiChatMessages.$inferSelect;
export type InsertAiChatMessage = typeof aiChatMessages.$inferInsert;

/**
 * Consultation messages table - normalized history view model for UI read-only playback.
 */
export const consultationMessages = mysqlTable(
  "consultation_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: int("sessionId")
      .notNull()
      .references(() => aiChatSessions.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["user", "ai"]).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    sessionIdx: index("consultationMessagesSessionIdx").on(table.sessionId),
    createdAtIdx: index("consultationMessagesCreatedAtIdx").on(table.createdAt),
  })
);

export type ConsultationMessage = typeof consultationMessages.$inferSelect;
export type InsertConsultationMessage = typeof consultationMessages.$inferInsert;

/**
 * Appointments table - reserved for future online booking feature
 */
export const appointments = mysqlTable(
  "appointments",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: varchar("sessionId", { length: 64 }),
    triageSessionId: int("triageSessionId")
      .notNull()
      .references(() => aiChatSessions.id, { onDelete: "restrict" }),
    userId: int("userId").references(() => users.id, { onDelete: "set null" }),
    doctorId: int("doctorId").notNull(),
    appointmentType: mysqlEnum("appointmentType", [
      "online_chat",
      "video_call",
      "in_person",
    ]).notNull(),
    scheduledAt: timestamp("scheduledAt"),
    status: mysqlEnum("status", [
      "draft",
      "pending_payment",
      "paid",
      "active",
      "ended",
      "completed",
      "expired",
      "refunded",
      "canceled",
    ])
      .default("draft")
      .notNull(),
    paymentStatus: mysqlEnum("paymentStatus", [
      "unpaid",
      "pending",
      "paid",
      "failed",
      "expired",
      "refunded",
      "canceled",
    ])
      .default("unpaid")
      .notNull(),
    stripeSessionId: varchar("stripeSessionId", { length: 255 }),
    amount: int("amount").notNull().default(1),
    currency: varchar("currency", { length: 8 }).notNull().default("usd"),
    paidAt: timestamp("paidAt"),
    email: varchar("email", { length: 320 }).notNull(),
    lastAccessAt: timestamp("lastAccessAt"),
    doctorLastAccessAt: timestamp("doctorLastAccessAt"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    doctorIdx: index("doctorIdx").on(table.doctorId),
    userIdx: index("userIdx").on(table.userId),
    sessionIdx: index("sessionIdx").on(table.sessionId),
    triageSessionIdx: index("triageSessionIdx").on(table.triageSessionId),
    emailIdx: index("emailIdx").on(table.email),
    stripeSessionIdUk: uniqueIndex("appointmentsStripeSessionIdUk").on(
      table.stripeSessionId
    ),
  })
);

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

export const appointmentTokens = mysqlTable(
  "appointmentTokens",
  {
    id: int("id").autoincrement().primaryKey(),
    appointmentId: int("appointmentId")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["patient", "doctor"]).notNull(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    lastUsedAt: timestamp("lastUsedAt"),
    useCount: int("useCount").notNull().default(0),
    maxUses: int("maxUses").notNull().default(1),
    revokedAt: timestamp("revokedAt"),
    revokeReason: text("revokeReason"),
    createdBy: varchar("createdBy", { length: 64 }),
    ipFirstSeen: varchar("ipFirstSeen", { length: 64 }),
    uaFirstSeen: varchar("uaFirstSeen", { length: 512 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    appointmentRoleIdx: index("appointmentTokensAppointmentRoleIdx").on(
      table.appointmentId,
      table.role
    ),
    expiresAtIdx: index("appointmentTokensExpiresAtIdx").on(table.expiresAt),
    revokedAtIdx: index("appointmentTokensRevokedAtIdx").on(table.revokedAt),
    tokenHashUk: uniqueIndex("appointmentTokensTokenHashUk").on(table.tokenHash),
  })
);

export type AppointmentToken = typeof appointmentTokens.$inferSelect;
export type InsertAppointmentToken = typeof appointmentTokens.$inferInsert;

/**
 * Appointment messages table - stores visit chat messages.
 */
export const appointmentMessages = mysqlTable(
  "appointmentMessages",
  {
    id: int("id").autoincrement().primaryKey(),
    appointmentId: int("appointmentId").notNull(),
    userId: int("userId").references(() => users.id, { onDelete: "set null" }),
    senderType: mysqlEnum("senderType", [
      "patient",
      "doctor",
      "system",
    ]).notNull(),
    content: text("content").notNull(),
    originalContent: text("originalContent"),
    translatedContent: text("translatedContent"),
    sourceLanguage: varchar("sourceLanguage", { length: 8 }),
    targetLanguage: varchar("targetLanguage", { length: 8 }),
    translationProvider: varchar("translationProvider", { length: 64 }),
    clientMessageId: varchar("clientMessageId", { length: 128 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    appointmentIdx: index("appointmentMessagesAppointmentIdx").on(
      table.appointmentId
    ),
    appointmentCreatedAtIdx: index("appointmentMessagesAppointmentCreatedAtIdx").on(
      table.appointmentId,
      table.createdAt
    ),
    userIdx: index("appointmentMessagesUserIdx").on(table.userId),
    createdAtIdx: index("appointmentMessagesCreatedAtIdx").on(table.createdAt),
    appointmentClientMessageUk: uniqueIndex(
      "appointmentMessagesAppointmentClientMessageUk"
    ).on(table.appointmentId, table.clientMessageId),
  })
);

export type AppointmentMessage = typeof appointmentMessages.$inferSelect;
export type InsertAppointmentMessage = typeof appointmentMessages.$inferInsert;

/**
 * Appointment status event log table - tracks all critical status transitions.
 */
export const appointmentStatusEvents = mysqlTable(
  "appointment_status_events",
  {
    id: int("id").autoincrement().primaryKey(),
    appointmentId: int("appointmentId")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    fromStatus: varchar("fromStatus", { length: 64 }),
    toStatus: varchar("toStatus", { length: 64 }).notNull(),
    operatorType: mysqlEnum("operatorType", [
      "system",
      "patient",
      "doctor",
      "admin",
      "webhook",
    ]).notNull(),
    operatorId: int("operatorId"),
    reason: text("reason"),
    payloadJson: json("payloadJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    appointmentIdx: index("appointmentStatusEventsAppointmentIdx").on(
      table.appointmentId
    ),
    createdAtIdx: index("appointmentStatusEventsCreatedAtIdx").on(
      table.createdAt
    ),
  })
);

export type AppointmentStatusEvent = typeof appointmentStatusEvents.$inferSelect;
export type InsertAppointmentStatusEvent =
  typeof appointmentStatusEvents.$inferInsert;

/**
 * Stripe webhook event log table - ensures event-level idempotency.
 */
export const stripeWebhookEvents = mysqlTable("stripe_webhook_events", {
  eventId: varchar("eventId", { length: 255 }).primaryKey(),
  type: varchar("type", { length: 100 }).notNull(),
  stripeSessionId: varchar("stripeSessionId", { length: 255 }),
  appointmentId: int("appointmentId"),
  payloadHash: varchar("payloadHash", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;
export type InsertStripeWebhookEvent = typeof stripeWebhookEvents.$inferInsert;

/**
 * Visit summary table - stores bilingual post-visit summaries per appointment.
 */
export const appointmentVisitSummaries = mysqlTable(
  "appointment_visit_summaries",
  {
    id: int("id").autoincrement().primaryKey(),
    appointmentId: int("appointmentId")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    summaryZh: text("summaryZh").notNull(),
    summaryEn: text("summaryEn").notNull(),
    source: varchar("source", { length: 32 }).notNull().default("llm"),
    generatedBy: int("generatedBy").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    appointmentUk: uniqueIndex("appointmentVisitSummariesAppointmentUk").on(
      table.appointmentId
    ),
    createdAtIdx: index("appointmentVisitSummariesCreatedAtIdx").on(table.createdAt),
  })
);

export type AppointmentVisitSummary = typeof appointmentVisitSummaries.$inferSelect;
export type InsertAppointmentVisitSummary =
  typeof appointmentVisitSummaries.$inferInsert;

/**
 * Structured medical summary table - stores doctor-reviewed SOAP summary per appointment.
 */
export const appointmentMedicalSummaries = mysqlTable(
  "appointment_medical_summaries",
  {
    id: int("id").autoincrement().primaryKey(),
    appointmentId: int("appointmentId")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    chiefComplaint: text("chiefComplaint").notNull(),
    historyOfPresentIllness: text("historyOfPresentIllness").notNull(),
    pastMedicalHistory: text("pastMedicalHistory").notNull(),
    assessmentDiagnosis: text("assessmentDiagnosis").notNull(),
    planRecommendations: text("planRecommendations").notNull(),
    source: varchar("source", { length: 32 }).notNull().default("doctor_reviewed_ai_draft"),
    signedBy: int("signedBy").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    appointmentUk: uniqueIndex("appointmentMedicalSummariesAppointmentUk").on(
      table.appointmentId
    ),
    createdAtIdx: index("appointmentMedicalSummariesCreatedAtIdx").on(table.createdAt),
  })
);

export type AppointmentMedicalSummary = typeof appointmentMedicalSummaries.$inferSelect;
export type InsertAppointmentMedicalSummary =
  typeof appointmentMedicalSummaries.$inferInsert;

/**
 * Retention policy table - configurable retention days by tier.
 */
export const visitRetentionPolicies = mysqlTable(
  "visit_retention_policies",
  {
    id: int("id").autoincrement().primaryKey(),
    tier: mysqlEnum("tier", ["free", "paid"]).notNull(),
    retentionDays: int("retentionDays").notNull(),
    enabled: tinyint("enabled").notNull().default(1),
    updatedBy: int("updatedBy").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    tierUk: uniqueIndex("visitRetentionPoliciesTierUk").on(table.tier),
  })
);

export type VisitRetentionPolicy = typeof visitRetentionPolicies.$inferSelect;
export type InsertVisitRetentionPolicy = typeof visitRetentionPolicies.$inferInsert;

/**
 * Retention cleanup audit table - records every cleanup run.
 */
export const retentionCleanupAudits = mysqlTable(
  "retention_cleanup_audits",
  {
    id: int("id").autoincrement().primaryKey(),
    dryRun: tinyint("dryRun").notNull().default(0),
    freeRetentionDays: int("freeRetentionDays").notNull(),
    paidRetentionDays: int("paidRetentionDays").notNull(),
    scannedMessages: int("scannedMessages").notNull().default(0),
    deletedMessages: int("deletedMessages").notNull().default(0),
    detailsJson: json("detailsJson"),
    createdBy: int("createdBy").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    createdAtIdx: index("retentionCleanupAuditsCreatedAtIdx").on(table.createdAt),
  })
);

export type RetentionCleanupAudit = typeof retentionCleanupAudits.$inferSelect;
export type InsertRetentionCleanupAudit = typeof retentionCleanupAudits.$inferInsert;
