import {
  customType,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
  real,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { DOCTOR_EMBEDDING_DIMENSIONS } from "../server/modules/doctors/embedding";

const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    if (!config?.dimensions) {
      throw new Error("vector column requires a dimensions config");
    }

    return `vector(${config.dimensions})`;
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
});

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  isGuest: integer("isGuest").notNull().default(1),
  deviceId: varchar("deviceId", { length: 128 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: text("role", { enum: ["free", "pro", "admin", "ops"] })
    .default("free")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Hospitals table - stores information about medical institutions
 */
export const hospitals = pgTable("hospitals", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
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
  translationStatus: text("translationStatus", { enum: [
    "pending",
    "done",
    "failed",
  ] }).default("pending"),
  translatedAt: timestamp("translatedAt"),
  lastTranslationError: text("lastTranslationError"),
  translationProvider: varchar("translationProvider", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
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
export const departments = pgTable(
  "departments",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    hospitalId: integer("hospitalId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    nameEn: varchar("nameEn", { length: 255 }),
    description: text("description"),
  descriptionEn: text("descriptionEn"),
  url: varchar("url", { length: 1024 }),
  sourceHash: varchar("sourceHash", { length: 64 }),
  translationStatus: text("translationStatus", { enum: [
    "pending",
    "done",
      "failed",
    ] }).default("pending"),
    translatedAt: timestamp("translatedAt"),
    lastTranslationError: text("lastTranslationError"),
    translationProvider: varchar("translationProvider", { length: 100 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
  },
  table => ({
    hospitalIdx: index("departmentsHospitalIdx").on(table.hospitalId),
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
export const doctors = pgTable(
  "doctors",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    hospitalId: integer("hospitalId").notNull(),
    departmentId: integer("departmentId").notNull(),
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
    sequenceNumber: integer("sequenceNumber"),
    satisfactionRate: text("satisfactionRate"),
    satisfactionRateEn: text("satisfactionRateEn"),
    attitudeScore: text("attitudeScore"),
    attitudeScoreEn: text("attitudeScoreEn"),
    recommendationScore: real("recommendationScore"),
    onlineConsultation: varchar("onlineConsultation", { length: 50 }),
    onlineConsultationEn: varchar("onlineConsultationEn", { length: 50 }),
    appointmentAvailable: text("appointmentAvailable"),
    appointmentAvailableEn: text("appointmentAvailableEn"),
    sourceHash: varchar("sourceHash", { length: 64 }),
    translationStatus: text("translationStatus", { enum: [
      "pending",
      "done",
      "failed",
    ] }).default("pending"),
    translatedAt: timestamp("translatedAt"),
    lastTranslationError: text("lastTranslationError"),
    translationProvider: varchar("translationProvider", { length: 100 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
  },
  table => ({
    hospitalIdx: index("doctorsHospitalIdx").on(table.hospitalId),
    departmentIdx: index("doctorsDepartmentIdx").on(table.departmentId),
    recommendationIdx: index("doctorsRecommendationIdx").on(table.recommendationScore),
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
export const doctorEmbeddings = pgTable(
  "doctorEmbeddings",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    doctorId: integer("doctorId").notNull().unique(),
    embeddingVector: vector("embeddingVector", {
      dimensions: DOCTOR_EMBEDDING_DIMENSIONS,
    }).notNull(),
    embeddingModel: varchar("embeddingModel", { length: 128 }).notNull(),
    embeddingDimensions: integer("embeddingDimensions").notNull(),
    content: text("content").notNull(), // Original text used for embedding
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
  },
  table => ({
    doctorIdx: index("doctorEmbeddingsDoctorIdx").on(table.doctorId),
    vectorIdx: index("doctorEmbeddingsVectorIdx").using(
      "hnsw",
      table.embeddingVector.op("vector_cosine_ops")
    ),
  })
);

export type DoctorEmbedding = typeof doctorEmbeddings.$inferSelect;
export type InsertDoctorEmbedding = typeof doctorEmbeddings.$inferInsert;

/**
 * Normalized specialty tags for doctor recommendation routing.
 */
export const doctorSpecialtyTags = pgTable(
  "doctor_specialty_tags",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    doctorId: integer("doctorId")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    tag: varchar("tag", { length: 64 }).notNull(),
    source: varchar("source", { length: 32 }).notNull().default("rule"),
    confidence: integer("confidence").notNull().default(100),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
  },
  table => ({
    doctorIdx: index("doctorSpecialtyTagsDoctorIdx").on(table.doctorId),
    tagIdx: index("doctorSpecialtyTagsTagIdx").on(table.tag),
    doctorTagUk: uniqueIndex("doctorSpecialtyTagsDoctorTagUk").on(
      table.doctorId,
      table.tag
    ),
  })
);

export type DoctorSpecialtyTag = typeof doctorSpecialtyTags.$inferSelect;
export type InsertDoctorSpecialtyTag = typeof doctorSpecialtyTags.$inferInsert;

export const doctorUserBindings = pgTable(
  "doctor_user_bindings",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    doctorId: integer("doctorId")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    status: text("status", {
      enum: ["pending_invite", "active", "revoked"],
    }).notNull().default("pending_invite"),
    boundAt: timestamp("boundAt"),
    revokedAt: timestamp("revokedAt"),
    createdByUserId: integer("createdByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedByUserId: integer("updatedByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
  },
  table => ({
    doctorIdx: index("doctorUserBindingsDoctorIdx").on(table.doctorId),
    userIdx: index("doctorUserBindingsUserIdx").on(table.userId),
    statusIdx: index("doctorUserBindingsStatusIdx").on(table.status),
    emailIdx: index("doctorUserBindingsEmailIdx").on(table.email),
  })
);

export type DoctorUserBinding = typeof doctorUserBindings.$inferSelect;
export type InsertDoctorUserBinding = typeof doctorUserBindings.$inferInsert;

export const doctorAccountInvites = pgTable(
  "doctor_account_invites",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    doctorId: integer("doctorId")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    status: text("status", {
      enum: ["pending", "sent", "accepted", "expired", "canceled"],
    }).notNull().default("pending"),
    expiresAt: timestamp("expiresAt").notNull(),
    sentAt: timestamp("sentAt"),
    acceptedAt: timestamp("acceptedAt"),
    createdByUserId: integer("createdByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    claimedByUserId: integer("claimedByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
  },
  table => ({
    doctorIdx: index("doctorAccountInvitesDoctorIdx").on(table.doctorId),
    emailIdx: index("doctorAccountInvitesEmailIdx").on(table.email),
    statusIdx: index("doctorAccountInvitesStatusIdx").on(table.status),
    expiresIdx: index("doctorAccountInvitesExpiresIdx").on(table.expiresAt),
    tokenHashUk: uniqueIndex("doctorAccountInvitesTokenHashUk").on(table.tokenHash),
  })
);

export type DoctorAccountInvite = typeof doctorAccountInvites.$inferSelect;
export type InsertDoctorAccountInvite = typeof doctorAccountInvites.$inferInsert;

/**
 * Patient sessions table - stores chat history and recommendations
 */
export const patientSessions = pgTable(
  "patientSessions",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
    userId: integer("userId").references(() => users.id, { onDelete: "set null" }),
    chatHistory: jsonb("chatHistory").notNull(), // Array of messages
    symptoms: text("symptoms"),
    duration: varchar("duration", { length: 100 }),
    age: integer("age"),
    medicalHistory: text("medicalHistory"),
    recommendedDoctors: jsonb("recommendedDoctors"), // Array of doctor IDs with reasons
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
  },
  table => ({
    sessionIdx: index("patientSessionsSessionIdx").on(table.sessionId),
    userIdx: index("patientSessionsUserIdx").on(table.userId),
  })
);

export type PatientSession = typeof patientSessions.$inferSelect;
export type InsertPatientSession = typeof patientSessions.$inferInsert;

/**
 * AI chat sessions table - stores one complete triage consultation session.
 */
export const aiChatSessions = pgTable(
  "ai_chat_sessions",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    userId: integer("userId").references(() => users.id, { onDelete: "set null" }),
    status: text("status", { enum: ["active", "completed"] })
      .default("active")
      .notNull(),
    summary: text("summary"),
    summaryGeneratedAt: timestamp("summaryGeneratedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
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
export const aiChatMessages = pgTable(
  "ai_chat_messages",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    sessionId: integer("sessionId")
      .notNull()
      .references(() => aiChatSessions.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
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

export const triageKnowledgeDocuments = pgTable(
  "triage_knowledge_documents",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    sourceType: varchar("sourceType", { length: 64 }).notNull().default("internal_card"),
    title: varchar("title", { length: 255 }).notNull(),
    lang: varchar("lang", { length: 8 }).notNull().default("zh"),
    body: text("body").notNull(),
    version: varchar("version", { length: 32 }).notNull().default("v1"),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    sourceUrl: varchar("sourceUrl", { length: 1024 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
  },
  table => ({
    sourceTypeIdx: index("triageKnowledgeDocumentsSourceTypeIdx").on(table.sourceType),
    statusIdx: index("triageKnowledgeDocumentsStatusIdx").on(table.status),
  })
);

export type TriageKnowledgeDocument = typeof triageKnowledgeDocuments.$inferSelect;
export type InsertTriageKnowledgeDocument = typeof triageKnowledgeDocuments.$inferInsert;

export const triageKnowledgeChunks = pgTable(
  "triage_knowledge_chunks",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    documentId: integer("documentId")
      .notNull()
      .references(() => triageKnowledgeDocuments.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunkIndex").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
    specialtyTags: jsonb("specialtyTags").$type<string[]>().notNull().default([]),
    riskCodes: jsonb("riskCodes").$type<string[]>().notNull().default([]),
    embeddingVector: vector("embeddingVector", { dimensions: 1024 }),
    embeddingModel: varchar("embeddingModel", { length: 128 }),
    embeddingDimensions: integer("embeddingDimensions"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
  },
  table => ({
    documentChunkIdx: index("triageKnowledgeChunksDocumentChunkIdx").on(
      table.documentId,
      table.chunkIndex
    ),
  })
);

export type TriageKnowledgeChunk = typeof triageKnowledgeChunks.$inferSelect;
export type InsertTriageKnowledgeChunk = typeof triageKnowledgeChunks.$inferInsert;

export const triageRiskEvents = pgTable(
  "triage_risk_events",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    sessionId: integer("sessionId")
      .notNull()
      .references(() => aiChatSessions.id, { onDelete: "cascade" }),
    messageId: integer("messageId").references(() => aiChatMessages.id, { onDelete: "set null" }),
    riskCode: varchar("riskCode", { length: 64 }).notNull(),
    severity: varchar("severity", { length: 16 }).notNull(),
    recommendedAction: varchar("recommendedAction", { length: 64 }).notNull(),
    triggerSource: varchar("triggerSource", { length: 32 }).notNull().default("rule"),
    rawExcerpt: text("rawExcerpt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    sessionCreatedIdx: index("triageRiskEventsSessionCreatedIdx").on(
      table.sessionId,
      table.createdAt
    ),
    riskCodeIdx: index("triageRiskEventsRiskCodeIdx").on(table.riskCode),
  })
);

export type TriageRiskEvent = typeof triageRiskEvents.$inferSelect;
export type InsertTriageRiskEvent = typeof triageRiskEvents.$inferInsert;

export const triageSessionFlags = pgTable(
  "triage_session_flags",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    sessionId: integer("sessionId")
      .notNull()
      .references(() => aiChatSessions.id, { onDelete: "cascade" }),
    flagType: varchar("flagType", { length: 64 }).notNull(),
    flagValue: text("flagValue").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    sessionFlagTypeIdx: index("triageSessionFlagsSessionFlagTypeIdx").on(
      table.sessionId,
      table.flagType
    ),
  })
);

export type TriageSessionFlag = typeof triageSessionFlags.$inferSelect;
export type InsertTriageSessionFlag = typeof triageSessionFlags.$inferInsert;

export const triageConsents = pgTable(
  "triage_consents",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    userId: integer("userId").references(() => users.id, { onDelete: "set null" }),
    sessionId: integer("sessionId")
      .notNull()
      .references(() => aiChatSessions.id, { onDelete: "cascade" }),
    consentType: varchar("consentType", { length: 64 }).notNull().default("triage_disclaimer"),
    consentVersion: varchar("consentVersion", { length: 32 }).notNull().default("stream_b_v1"),
    acceptedAt: timestamp("acceptedAt").defaultNow().notNull(),
    lang: varchar("lang", { length: 8 }).notNull().default("zh"),
  },
  table => ({
    sessionConsentTypeIdx: index("triageConsentsSessionConsentTypeIdx").on(
      table.sessionId,
      table.consentType
    ),
  })
);

export type TriageConsent = typeof triageConsents.$inferSelect;
export type InsertTriageConsent = typeof triageConsents.$inferInsert;

export const doctorScheduleRules = pgTable(
  "doctor_schedule_rules",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    doctorId: integer("doctorId")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    weekday: integer("weekday").notNull(),
    startLocalTime: varchar("startLocalTime", { length: 5 }).notNull(),
    endLocalTime: varchar("endLocalTime", { length: 5 }).notNull(),
    slotDurationMinutes: integer("slotDurationMinutes").notNull(),
    appointmentTypeScope: text("appointmentTypeScope", {
      enum: ["online_chat", "video_call", "in_person"],
    }).notNull(),
    validFrom: varchar("validFrom", { length: 10 }),
    validTo: varchar("validTo", { length: 10 }),
    isActive: integer("isActive").notNull().default(1),
    createdByRole: varchar("createdByRole", { length: 32 }).notNull().default("admin"),
    createdByUserId: integer("createdByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
  },
  table => ({
    doctorIdx: index("doctorScheduleRulesDoctorIdx").on(table.doctorId),
    activeIdx: index("doctorScheduleRulesDoctorActiveIdx").on(table.doctorId, table.isActive),
  })
);

export type DoctorScheduleRule = typeof doctorScheduleRules.$inferSelect;
export type InsertDoctorScheduleRule = typeof doctorScheduleRules.$inferInsert;

export const doctorScheduleExceptions = pgTable(
  "doctor_schedule_exceptions",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    doctorId: integer("doctorId")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    dateLocal: varchar("dateLocal", { length: 10 }).notNull(),
    action: text("action", { enum: ["block", "extend", "replace"] }).notNull(),
    startLocalTime: varchar("startLocalTime", { length: 5 }),
    endLocalTime: varchar("endLocalTime", { length: 5 }),
    reason: text("reason"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
  },
  table => ({
    doctorDateIdx: index("doctorScheduleExceptionsDoctorDateIdx").on(
      table.doctorId,
      table.dateLocal
    ),
  })
);

export type DoctorScheduleException = typeof doctorScheduleExceptions.$inferSelect;
export type InsertDoctorScheduleException = typeof doctorScheduleExceptions.$inferInsert;

export const doctorSlots = pgTable(
  "doctor_slots",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    doctorId: integer("doctorId")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    appointmentType: text("appointmentType", {
      enum: ["online_chat", "video_call", "in_person"],
    }).notNull(),
    slotDurationMinutes: integer("slotDurationMinutes").notNull(),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    localDate: varchar("localDate", { length: 10 }).notNull(),
    startAt: timestamp("startAt").notNull(),
    endAt: timestamp("endAt").notNull(),
    status: text("status", {
      enum: ["open", "held", "booked", "blocked", "expired"],
    })
      .notNull()
      .default("open"),
    source: text("source", { enum: ["rule", "manual"] }).notNull().default("rule"),
    scheduleRuleId: integer("scheduleRuleId").references(() => doctorScheduleRules.id, {
      onDelete: "set null",
    }),
    holdExpiresAt: timestamp("holdExpiresAt"),
    heldBySessionId: varchar("heldBySessionId", { length: 128 }),
    appointmentId: integer("appointmentId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
  },
  table => ({
    doctorLocalDateIdx: index("doctorSlotsDoctorLocalDateIdx").on(table.doctorId, table.localDate),
    statusStartIdx: index("doctorSlotsStatusStartIdx").on(table.status, table.startAt),
    holdExpiresIdx: index("doctorSlotsHoldExpiresIdx").on(table.holdExpiresAt),
    appointmentIdx: index("doctorSlotsAppointmentIdx").on(table.appointmentId),
    slotUk: uniqueIndex("doctorSlotsDoctorTypeStartUk").on(
      table.doctorId,
      table.appointmentType,
      table.startAt
    ),
  })
);

export type DoctorSlot = typeof doctorSlots.$inferSelect;
export type InsertDoctorSlot = typeof doctorSlots.$inferInsert;

/**
 * Consultation messages table - normalized history view model for UI read-only playback.
 */
export const consultationMessages = pgTable(
  "consultation_messages",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    sessionId: integer("sessionId")
      .notNull()
      .references(() => aiChatSessions.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "ai"] }).notNull(),
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
export const appointments = pgTable(
  "appointments",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    slotId: integer("slotId"),
    sessionId: varchar("sessionId", { length: 64 }),
    triageSessionId: integer("triageSessionId")
      .notNull()
      .references(() => aiChatSessions.id, { onDelete: "restrict" }),
    userId: integer("userId").references(() => users.id, { onDelete: "set null" }),
    doctorId: integer("doctorId").notNull(),
    appointmentType: text("appointmentType", { enum: [
      "online_chat",
      "video_call",
      "in_person",
    ] }).notNull(),
    scheduledAt: timestamp("scheduledAt"),
    status: text("status", { enum: [
      "draft",
      "pending_payment",
      "paid",
      "active",
      "ended",
      "completed",
      "expired",
      "refunded",
      "canceled",
    ] })
      .default("draft")
      .notNull(),
    paymentStatus: text("paymentStatus", { enum: [
      "unpaid",
      "pending",
      "paid",
      "failed",
      "expired",
      "refunded",
      "canceled",
    ] })
      .default("unpaid")
      .notNull(),
    paymentProvider: text("paymentProvider", { enum: ["stripe", "paypal"] })
      .notNull()
      .default("stripe"),
    stripeSessionId: varchar("stripeSessionId", { length: 255 }),
    amount: integer("amount").notNull().default(1),
    currency: varchar("currency", { length: 8 }).notNull().default("usd"),
    paidAt: timestamp("paidAt"),
    email: varchar("email", { length: 320 }).notNull(),
    lastAccessAt: timestamp("lastAccessAt"),
    doctorLastAccessAt: timestamp("doctorLastAccessAt"),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
  },
  table => ({
    doctorIdx: index("appointmentsDoctorIdx").on(table.doctorId),
    slotIdx: index("appointmentsSlotIdx").on(table.slotId),
    userIdx: index("appointmentsUserIdx").on(table.userId),
    sessionIdx: index("appointmentsSessionIdx").on(table.sessionId),
    triageSessionIdx: index("appointmentsTriageSessionIdx").on(table.triageSessionId),
    emailIdx: index("appointmentsEmailIdx").on(table.email),
    stripeSessionIdUk: uniqueIndex("appointmentsStripeSessionIdUk").on(
      table.stripeSessionId
    ),
  })
);

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

export const appointmentTokens = pgTable(
  "appointmentTokens",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    appointmentId: integer("appointmentId")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["patient", "doctor"] }).notNull(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    lastUsedAt: timestamp("lastUsedAt"),
    useCount: integer("useCount").notNull().default(0),
    maxUses: integer("maxUses").notNull().default(1),
    revokedAt: timestamp("revokedAt"),
    revokeReason: text("revokeReason"),
    createdBy: varchar("createdBy", { length: 64 }),
    ipFirstSeen: varchar("ipFirstSeen", { length: 64 }),
    uaFirstSeen: varchar("uaFirstSeen", { length: 512 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
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
export const appointmentMessages = pgTable(
  "appointmentMessages",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    appointmentId: integer("appointmentId").notNull(),
    userId: integer("userId").references(() => users.id, { onDelete: "set null" }),
    senderType: text("senderType", { enum: [
      "patient",
      "doctor",
      "system",
    ] }).notNull(),
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
export const appointmentStatusEvents = pgTable(
  "appointment_status_events",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    appointmentId: integer("appointmentId")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    fromStatus: varchar("fromStatus", { length: 64 }),
    toStatus: varchar("toStatus", { length: 64 }).notNull(),
    operatorType: text("operatorType", { enum: [
      "system",
      "patient",
      "doctor",
      "admin",
      "webhook",
    ] }).notNull(),
    operatorId: integer("operatorId"),
    reason: text("reason"),
    payloadJson: jsonb("payloadJson"),
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
export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
  eventId: varchar("eventId", { length: 255 }).primaryKey(),
  type: varchar("type", { length: 100 }).notNull(),
  provider: text("provider", { enum: ["stripe", "paypal"] }).notNull().default("stripe"),
  stripeSessionId: varchar("stripeSessionId", { length: 255 }),
  appointmentId: integer("appointmentId"),
  payloadHash: varchar("payloadHash", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;
export type InsertStripeWebhookEvent = typeof stripeWebhookEvents.$inferInsert;

/**
 * Visit summary table - stores bilingual post-visit summaries per appointment.
 */
export const appointmentVisitSummaries = pgTable(
  "appointment_visit_summaries",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    appointmentId: integer("appointmentId")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    summaryZh: text("summaryZh").notNull(),
    summaryEn: text("summaryEn").notNull(),
    source: varchar("source", { length: 32 }).notNull().default("llm"),
    generatedBy: integer("generatedBy").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
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
export const appointmentMedicalSummaries = pgTable(
  "appointment_medical_summaries",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    appointmentId: integer("appointmentId")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    chiefComplaint: text("chiefComplaint").notNull(),
    historyOfPresentIllness: text("historyOfPresentIllness").notNull(),
    pastMedicalHistory: text("pastMedicalHistory").notNull(),
    assessmentDiagnosis: text("assessmentDiagnosis").notNull(),
    planRecommendations: text("planRecommendations").notNull(),
    source: varchar("source", { length: 32 }).notNull().default("doctor_reviewed_ai_draft"),
    signedBy: integer("signedBy").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
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
export const visitRetentionPolicies = pgTable(
  "visit_retention_policies",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    tier: text("tier", { enum: ["free", "paid"] }).notNull(),
    retentionDays: integer("retentionDays").notNull(),
    enabled: integer("enabled").notNull().default(1),
    updatedBy: integer("updatedBy").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
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
export const retentionCleanupAudits = pgTable(
  "retention_cleanup_audits",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    dryRun: integer("dryRun").notNull().default(0),
    freeRetentionDays: integer("freeRetentionDays").notNull(),
    paidRetentionDays: integer("paidRetentionDays").notNull(),
    scannedMessages: integer("scannedMessages").notNull().default(0),
    deletedMessages: integer("deletedMessages").notNull().default(0),
    detailsJson: jsonb("detailsJson"),
    createdBy: integer("createdBy").references(() => users.id, {
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
