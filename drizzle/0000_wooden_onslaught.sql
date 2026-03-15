CREATE TABLE "ai_chat_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_chat_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sessionId" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_chat_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"summary" text,
	"summaryGeneratedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_medical_summaries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "appointment_medical_summaries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"appointmentId" integer NOT NULL,
	"chiefComplaint" text NOT NULL,
	"historyOfPresentIllness" text NOT NULL,
	"pastMedicalHistory" text NOT NULL,
	"assessmentDiagnosis" text NOT NULL,
	"planRecommendations" text NOT NULL,
	"source" varchar(32) DEFAULT 'doctor_reviewed_ai_draft' NOT NULL,
	"signedBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointmentMessages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "appointmentMessages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"appointmentId" integer NOT NULL,
	"userId" integer,
	"senderType" text NOT NULL,
	"content" text NOT NULL,
	"originalContent" text,
	"translatedContent" text,
	"sourceLanguage" varchar(8),
	"targetLanguage" varchar(8),
	"translationProvider" varchar(64),
	"clientMessageId" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_status_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "appointment_status_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"appointmentId" integer NOT NULL,
	"fromStatus" varchar(64),
	"toStatus" varchar(64) NOT NULL,
	"operatorType" text NOT NULL,
	"operatorId" integer,
	"reason" text,
	"payloadJson" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointmentTokens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "appointmentTokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"appointmentId" integer NOT NULL,
	"role" text NOT NULL,
	"tokenHash" varchar(64) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"lastUsedAt" timestamp,
	"useCount" integer DEFAULT 0 NOT NULL,
	"maxUses" integer DEFAULT 1 NOT NULL,
	"revokedAt" timestamp,
	"revokeReason" text,
	"createdBy" varchar(64),
	"ipFirstSeen" varchar(64),
	"uaFirstSeen" varchar(512),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_visit_summaries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "appointment_visit_summaries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"appointmentId" integer NOT NULL,
	"summaryZh" text NOT NULL,
	"summaryEn" text NOT NULL,
	"source" varchar(32) DEFAULT 'llm' NOT NULL,
	"generatedBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "appointments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sessionId" varchar(64),
	"triageSessionId" integer NOT NULL,
	"userId" integer,
	"doctorId" integer NOT NULL,
	"appointmentType" text NOT NULL,
	"scheduledAt" timestamp,
	"status" text DEFAULT 'draft' NOT NULL,
	"paymentStatus" text DEFAULT 'unpaid' NOT NULL,
	"paymentProvider" text DEFAULT 'stripe' NOT NULL,
	"stripeSessionId" varchar(255),
	"amount" integer DEFAULT 1 NOT NULL,
	"currency" varchar(8) DEFAULT 'usd' NOT NULL,
	"paidAt" timestamp,
	"email" varchar(320) NOT NULL,
	"lastAccessAt" timestamp,
	"doctorLastAccessAt" timestamp,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultation_messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "consultation_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sessionId" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "departments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"hospitalId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"nameEn" varchar(255),
	"description" text,
	"descriptionEn" text,
	"url" varchar(1024),
	"sourceHash" varchar(64),
	"translationStatus" text DEFAULT 'pending',
	"translatedAt" timestamp,
	"lastTranslationError" text,
	"translationProvider" varchar(100),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctorEmbeddings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "doctorEmbeddings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doctorId" integer NOT NULL,
	"embedding" jsonb NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "doctorEmbeddings_doctorId_unique" UNIQUE("doctorId")
);
--> statement-breakpoint
CREATE TABLE "doctor_specialty_tags" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "doctor_specialty_tags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doctorId" integer NOT NULL,
	"tag" varchar(64) NOT NULL,
	"source" varchar(32) DEFAULT 'rule' NOT NULL,
	"confidence" integer DEFAULT 100 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "doctors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"hospitalId" integer NOT NULL,
	"departmentId" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"nameEn" varchar(100),
	"title" varchar(100),
	"titleEn" varchar(100),
	"specialty" text,
	"experience" text,
	"description" text,
	"imageUrl" varchar(500),
	"specialtyEn" text,
	"expertise" text,
	"expertiseEn" text,
	"sourceDoctorId" varchar(128),
	"websiteUrl" varchar(500),
	"haodafUrl" varchar(500),
	"totalPatients" varchar(100),
	"totalArticles" varchar(100),
	"totalVisits" varchar(100),
	"scrapedDate" varchar(100),
	"scrapedStatus" varchar(64),
	"dataSource" varchar(255),
	"educationExperience" text,
	"socialRole" text,
	"researchAchievements" text,
	"honors" text,
	"followUpPatients" varchar(100),
	"followUpFeedback" text,
	"gender" varchar(20),
	"sequenceNumber" integer,
	"satisfactionRate" text,
	"satisfactionRateEn" text,
	"attitudeScore" text,
	"attitudeScoreEn" text,
	"recommendationScore" real,
	"onlineConsultation" varchar(50),
	"onlineConsultationEn" varchar(50),
	"appointmentAvailable" text,
	"appointmentAvailableEn" text,
	"sourceHash" varchar(64),
	"translationStatus" text DEFAULT 'pending',
	"translatedAt" timestamp,
	"lastTranslationError" text,
	"translationProvider" varchar(100),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hospitals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hospitals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"nameEn" varchar(255),
	"city" varchar(100) DEFAULT '上海' NOT NULL,
	"cityEn" varchar(100),
	"level" varchar(50) DEFAULT '三级甲等',
	"levelEn" varchar(50),
	"address" text,
	"addressEn" text,
	"contact" varchar(100),
	"website" varchar(255),
	"description" text,
	"descriptionEn" text,
	"imageUrl" varchar(500),
	"sourceHash" varchar(64),
	"translationStatus" text DEFAULT 'pending',
	"translatedAt" timestamp,
	"lastTranslationError" text,
	"translationProvider" varchar(100),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patientSessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "patientSessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sessionId" varchar(64) NOT NULL,
	"userId" integer,
	"chatHistory" jsonb NOT NULL,
	"symptoms" text,
	"duration" varchar(100),
	"age" integer,
	"medicalHistory" text,
	"recommendedDoctors" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "patientSessions_sessionId_unique" UNIQUE("sessionId")
);
--> statement-breakpoint
CREATE TABLE "retention_cleanup_audits" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "retention_cleanup_audits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"dryRun" integer DEFAULT 0 NOT NULL,
	"freeRetentionDays" integer NOT NULL,
	"paidRetentionDays" integer NOT NULL,
	"scannedMessages" integer DEFAULT 0 NOT NULL,
	"deletedMessages" integer DEFAULT 0 NOT NULL,
	"detailsJson" jsonb,
	"createdBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"eventId" varchar(255) PRIMARY KEY NOT NULL,
	"type" varchar(100) NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"stripeSessionId" varchar(255),
	"appointmentId" integer,
	"payloadHash" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"openId" varchar(64),
	"name" text,
	"email" varchar(320),
	"isGuest" integer DEFAULT 1 NOT NULL,
	"deviceId" varchar(128),
	"loginMethod" varchar(64),
	"role" text DEFAULT 'free' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_deviceId_unique" UNIQUE("deviceId")
);
--> statement-breakpoint
CREATE TABLE "visit_retention_policies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "visit_retention_policies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tier" text NOT NULL,
	"retentionDays" integer NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"updatedBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_sessionId_ai_chat_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."ai_chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_medical_summaries" ADD CONSTRAINT "appointment_medical_summaries_appointmentId_appointments_id_fk" FOREIGN KEY ("appointmentId") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_medical_summaries" ADD CONSTRAINT "appointment_medical_summaries_signedBy_users_id_fk" FOREIGN KEY ("signedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointmentMessages" ADD CONSTRAINT "appointmentMessages_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_status_events" ADD CONSTRAINT "appointment_status_events_appointmentId_appointments_id_fk" FOREIGN KEY ("appointmentId") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointmentTokens" ADD CONSTRAINT "appointmentTokens_appointmentId_appointments_id_fk" FOREIGN KEY ("appointmentId") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_visit_summaries" ADD CONSTRAINT "appointment_visit_summaries_appointmentId_appointments_id_fk" FOREIGN KEY ("appointmentId") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_visit_summaries" ADD CONSTRAINT "appointment_visit_summaries_generatedBy_users_id_fk" FOREIGN KEY ("generatedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_triageSessionId_ai_chat_sessions_id_fk" FOREIGN KEY ("triageSessionId") REFERENCES "public"."ai_chat_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_messages" ADD CONSTRAINT "consultation_messages_sessionId_ai_chat_sessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."ai_chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_specialty_tags" ADD CONSTRAINT "doctor_specialty_tags_doctorId_doctors_id_fk" FOREIGN KEY ("doctorId") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patientSessions" ADD CONSTRAINT "patientSessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_cleanup_audits" ADD CONSTRAINT "retention_cleanup_audits_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_retention_policies" ADD CONSTRAINT "visit_retention_policies_updatedBy_users_id_fk" FOREIGN KEY ("updatedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aiChatMessagesSessionIdx" ON "ai_chat_messages" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "aiChatMessagesCreatedAtIdx" ON "ai_chat_messages" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "aiChatSessionsUserIdx" ON "ai_chat_sessions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "aiChatSessionsStatusIdx" ON "ai_chat_sessions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "appointmentMedicalSummariesAppointmentUk" ON "appointment_medical_summaries" USING btree ("appointmentId");--> statement-breakpoint
CREATE INDEX "appointmentMedicalSummariesCreatedAtIdx" ON "appointment_medical_summaries" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "appointmentMessagesAppointmentIdx" ON "appointmentMessages" USING btree ("appointmentId");--> statement-breakpoint
CREATE INDEX "appointmentMessagesAppointmentCreatedAtIdx" ON "appointmentMessages" USING btree ("appointmentId","createdAt");--> statement-breakpoint
CREATE INDEX "appointmentMessagesUserIdx" ON "appointmentMessages" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "appointmentMessagesCreatedAtIdx" ON "appointmentMessages" USING btree ("createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "appointmentMessagesAppointmentClientMessageUk" ON "appointmentMessages" USING btree ("appointmentId","clientMessageId");--> statement-breakpoint
CREATE INDEX "appointmentStatusEventsAppointmentIdx" ON "appointment_status_events" USING btree ("appointmentId");--> statement-breakpoint
CREATE INDEX "appointmentStatusEventsCreatedAtIdx" ON "appointment_status_events" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "appointmentTokensAppointmentRoleIdx" ON "appointmentTokens" USING btree ("appointmentId","role");--> statement-breakpoint
CREATE INDEX "appointmentTokensExpiresAtIdx" ON "appointmentTokens" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "appointmentTokensRevokedAtIdx" ON "appointmentTokens" USING btree ("revokedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "appointmentTokensTokenHashUk" ON "appointmentTokens" USING btree ("tokenHash");--> statement-breakpoint
CREATE UNIQUE INDEX "appointmentVisitSummariesAppointmentUk" ON "appointment_visit_summaries" USING btree ("appointmentId");--> statement-breakpoint
CREATE INDEX "appointmentVisitSummariesCreatedAtIdx" ON "appointment_visit_summaries" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "appointmentsDoctorIdx" ON "appointments" USING btree ("doctorId");--> statement-breakpoint
CREATE INDEX "appointmentsUserIdx" ON "appointments" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "appointmentsSessionIdx" ON "appointments" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "appointmentsTriageSessionIdx" ON "appointments" USING btree ("triageSessionId");--> statement-breakpoint
CREATE INDEX "appointmentsEmailIdx" ON "appointments" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "appointmentsStripeSessionIdUk" ON "appointments" USING btree ("stripeSessionId");--> statement-breakpoint
CREATE INDEX "consultationMessagesSessionIdx" ON "consultation_messages" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "consultationMessagesCreatedAtIdx" ON "consultation_messages" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "departmentsHospitalIdx" ON "departments" USING btree ("hospitalId");--> statement-breakpoint
CREATE INDEX "departmentsTranslationStatusIdx" ON "departments" USING btree ("translationStatus");--> statement-breakpoint
CREATE INDEX "departmentsTranslationStatusIdIdx" ON "departments" USING btree ("translationStatus","id");--> statement-breakpoint
CREATE INDEX "doctorEmbeddingsDoctorIdx" ON "doctorEmbeddings" USING btree ("doctorId");--> statement-breakpoint
CREATE INDEX "doctorSpecialtyTagsDoctorIdx" ON "doctor_specialty_tags" USING btree ("doctorId");--> statement-breakpoint
CREATE INDEX "doctorSpecialtyTagsTagIdx" ON "doctor_specialty_tags" USING btree ("tag");--> statement-breakpoint
CREATE UNIQUE INDEX "doctorSpecialtyTagsDoctorTagUk" ON "doctor_specialty_tags" USING btree ("doctorId","tag");--> statement-breakpoint
CREATE INDEX "doctorsHospitalIdx" ON "doctors" USING btree ("hospitalId");--> statement-breakpoint
CREATE INDEX "doctorsDepartmentIdx" ON "doctors" USING btree ("departmentId");--> statement-breakpoint
CREATE INDEX "doctorsRecommendationIdx" ON "doctors" USING btree ("recommendationScore");--> statement-breakpoint
CREATE INDEX "doctorsTranslationStatusIdx" ON "doctors" USING btree ("translationStatus");--> statement-breakpoint
CREATE INDEX "doctorsTranslationStatusIdIdx" ON "doctors" USING btree ("translationStatus","id");--> statement-breakpoint
CREATE UNIQUE INDEX "doctorHospitalDepartmentNameUk" ON "doctors" USING btree ("hospitalId","departmentId","name");--> statement-breakpoint
CREATE INDEX "hospitalsTranslationStatusIdx" ON "hospitals" USING btree ("translationStatus");--> statement-breakpoint
CREATE INDEX "hospitalsTranslationStatusIdIdx" ON "hospitals" USING btree ("translationStatus","id");--> statement-breakpoint
CREATE INDEX "patientSessionsSessionIdx" ON "patientSessions" USING btree ("sessionId");--> statement-breakpoint
CREATE INDEX "patientSessionsUserIdx" ON "patientSessions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "retentionCleanupAuditsCreatedAtIdx" ON "retention_cleanup_audits" USING btree ("createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "visitRetentionPoliciesTierUk" ON "visit_retention_policies" USING btree ("tier");