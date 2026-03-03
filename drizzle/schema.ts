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
  role: mysqlEnum("role", ["free", "pro"]).default("free").notNull(),
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
});

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
    websiteUrl: varchar("websiteUrl", { length: 500 }),
    haodafUrl: varchar("haodafUrl", { length: 500 }),
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
      "confirmed",
      "in_session",
      "completed",
      "expired",
      "refunded",
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
    ])
      .default("unpaid")
      .notNull(),
    stripeSessionId: varchar("stripeSessionId", { length: 255 }),
    amount: int("amount").notNull().default(1),
    currency: varchar("currency", { length: 8 }).notNull().default("usd"),
    paidAt: timestamp("paidAt"),
    email: varchar("email", { length: 320 }).notNull(),
    accessTokenHash: varchar("accessTokenHash", { length: 128 }),
    doctorTokenHash: varchar("doctorTokenHash", { length: 128 }),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
    accessTokenRevokedAt: timestamp("accessTokenRevokedAt"),
    doctorTokenRevokedAt: timestamp("doctorTokenRevokedAt"),
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
    doctorTokenHashIdx: index("doctorTokenHashIdx").on(table.doctorTokenHash),
  })
);

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

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
    clientMsgId: varchar("clientMsgId", { length: 128 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    appointmentIdx: index("appointmentMessagesAppointmentIdx").on(
      table.appointmentId
    ),
    userIdx: index("appointmentMessagesUserIdx").on(table.userId),
    createdAtIdx: index("appointmentMessagesCreatedAtIdx").on(table.createdAt),
    appointmentClientMsgUk: uniqueIndex(
      "appointmentMessagesAppointmentClientMsgUk"
    ).on(table.appointmentId, table.clientMsgId),
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
