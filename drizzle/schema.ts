import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, float, json, index } from "drizzle-orm/mysql-core";

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
  level: varchar("level", { length: 50 }).default("三级甲等"),
  address: text("address"),
  contact: varchar("contact", { length: 100 }),
  website: varchar("website", { length: 255 }),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Hospital = typeof hospitals.$inferSelect;
export type InsertHospital = typeof hospitals.$inferInsert;

/**
 * Departments table - stores hospital departments/specialties
 */
export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  hospitalId: int("hospitalId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  hospitalIdx: index("hospitalIdx").on(table.hospitalId),
}));

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;

/**
 * Doctors table - stores doctor information
 */
export const doctors = mysqlTable("doctors", {
  id: int("id").autoincrement().primaryKey(),
  hospitalId: int("hospitalId").notNull(),
  departmentId: int("departmentId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  nameEn: varchar("nameEn", { length: 100 }),
  title: varchar("title", { length: 100 }),
  specialty: text("specialty"),
  specialtyEn: text("specialtyEn"),
  expertise: text("expertise"),
  expertiseEn: text("expertiseEn"),
  websiteUrl: varchar("websiteUrl", { length: 500 }),
  haodafUrl: varchar("haodafUrl", { length: 500 }),
  satisfactionRate: text("satisfactionRate"),
  attitudeScore: text("attitudeScore"),
  recommendationScore: float("recommendationScore"),
  onlineConsultation: varchar("onlineConsultation", { length: 50 }),
  appointmentAvailable: text("appointmentAvailable"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  hospitalIdx: index("hospitalIdx").on(table.hospitalId),
  departmentIdx: index("departmentIdx").on(table.departmentId),
  recommendationIdx: index("recommendationIdx").on(table.recommendationScore),
}));

export type Doctor = typeof doctors.$inferSelect;
export type InsertDoctor = typeof doctors.$inferInsert;

/**
 * Doctor embeddings table - stores vector embeddings for RAG
 */
export const doctorEmbeddings = mysqlTable("doctorEmbeddings", {
  id: int("id").autoincrement().primaryKey(),
  doctorId: int("doctorId").notNull().unique(),
  embedding: json("embedding").notNull(), // Store as JSON array
  content: text("content").notNull(), // Original text used for embedding
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  doctorIdx: index("doctorIdx").on(table.doctorId),
}));

export type DoctorEmbedding = typeof doctorEmbeddings.$inferSelect;
export type InsertDoctorEmbedding = typeof doctorEmbeddings.$inferInsert;

/**
 * Patient sessions table - stores chat history and recommendations
 */
export const patientSessions = mysqlTable("patientSessions", {
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
}, (table) => ({
  sessionIdx: index("sessionIdx").on(table.sessionId),
  userIdx: index("userIdx").on(table.userId),
}));

export type PatientSession = typeof patientSessions.$inferSelect;
export type InsertPatientSession = typeof patientSessions.$inferInsert;

/**
 * Appointments table - reserved for future online booking feature
 */
export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }),
  userId: int("userId"),
  doctorId: int("doctorId").notNull(),
  appointmentType: mysqlEnum("appointmentType", ["online_chat", "video_call", "in_person"]).notNull(),
  scheduledAt: timestamp("scheduledAt"),
  status: mysqlEnum("status", ["pending", "confirmed", "completed", "cancelled"]).default("pending").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  doctorIdx: index("doctorIdx").on(table.doctorId),
  userIdx: index("userIdx").on(table.userId),
  sessionIdx: index("sessionIdx").on(table.sessionId),
}));

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;
