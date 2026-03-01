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
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
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
    userId: int("userId"), // Optional: link to user if authenticated
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
 * Appointments table - reserved for future online booking feature
 */
export const appointments = mysqlTable(
  "appointments",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: varchar("sessionId", { length: 64 }),
    userId: int("userId"),
    doctorId: int("doctorId").notNull(),
    appointmentType: mysqlEnum("appointmentType", [
      "online_chat",
      "video_call",
      "in_person",
    ]).notNull(),
    scheduledAt: timestamp("scheduledAt"),
    status: mysqlEnum("status", [
      "pending",
      "confirmed",
      "rescheduled",
      "completed",
      "cancelled",
    ])
      .default("pending")
      .notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    accessTokenHash: varchar("accessTokenHash", { length: 128 }).notNull(),
    doctorTokenHash: varchar("doctorTokenHash", { length: 128 }),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt").notNull(),
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
    emailIdx: index("emailIdx").on(table.email),
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
    senderType: mysqlEnum("senderType", [
      "patient",
      "doctor",
      "system",
    ]).notNull(),
    content: text("content").notNull(),
    clientMsgId: varchar("clientMsgId", { length: 128 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    appointmentIdx: index("appointmentMessagesAppointmentIdx").on(
      table.appointmentId
    ),
    createdAtIdx: index("appointmentMessagesCreatedAtIdx").on(table.createdAt),
    appointmentClientMsgUk: uniqueIndex(
      "appointmentMessagesAppointmentClientMsgUk"
    ).on(table.appointmentId, table.clientMsgId),
  })
);

export type AppointmentMessage = typeof appointmentMessages.$inferSelect;
export type InsertAppointmentMessage = typeof appointmentMessages.$inferInsert;
