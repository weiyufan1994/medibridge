CREATE TABLE "doctor_schedule_rules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "doctor_schedule_rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doctorId" integer NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"weekday" integer NOT NULL,
	"startLocalTime" varchar(5) NOT NULL,
	"endLocalTime" varchar(5) NOT NULL,
	"slotDurationMinutes" integer NOT NULL,
	"appointmentTypeScope" text NOT NULL,
	"validFrom" varchar(10),
	"validTo" varchar(10),
	"isActive" integer DEFAULT 1 NOT NULL,
	"createdByRole" varchar(32) DEFAULT 'admin' NOT NULL,
	"createdByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctor_schedule_exceptions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "doctor_schedule_exceptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doctorId" integer NOT NULL,
	"dateLocal" varchar(10) NOT NULL,
	"action" text NOT NULL,
	"startLocalTime" varchar(5),
	"endLocalTime" varchar(5),
	"reason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctor_slots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "doctor_slots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doctorId" integer NOT NULL,
	"appointmentType" text NOT NULL,
	"slotDurationMinutes" integer NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"localDate" varchar(10) NOT NULL,
	"startAt" timestamp NOT NULL,
	"endAt" timestamp NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"source" text DEFAULT 'rule' NOT NULL,
	"scheduleRuleId" integer,
	"holdExpiresAt" timestamp,
	"heldBySessionId" varchar(128),
	"appointmentId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "slotId" integer;
--> statement-breakpoint
ALTER TABLE "doctor_schedule_rules" ADD CONSTRAINT "doctor_schedule_rules_doctorId_doctors_id_fk" FOREIGN KEY ("doctorId") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "doctor_schedule_rules" ADD CONSTRAINT "doctor_schedule_rules_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "doctor_schedule_exceptions" ADD CONSTRAINT "doctor_schedule_exceptions_doctorId_doctors_id_fk" FOREIGN KEY ("doctorId") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "doctor_slots" ADD CONSTRAINT "doctor_slots_doctorId_doctors_id_fk" FOREIGN KEY ("doctorId") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "doctor_slots" ADD CONSTRAINT "doctor_slots_scheduleRuleId_doctor_schedule_rules_id_fk" FOREIGN KEY ("scheduleRuleId") REFERENCES "public"."doctor_schedule_rules"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "doctor_slots" ADD CONSTRAINT "doctor_slots_appointmentId_appointments_id_fk" FOREIGN KEY ("appointmentId") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_slotId_doctor_slots_id_fk" FOREIGN KEY ("slotId") REFERENCES "public"."doctor_slots"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "doctorScheduleRulesDoctorIdx" ON "doctor_schedule_rules" USING btree ("doctorId");
--> statement-breakpoint
CREATE INDEX "doctorScheduleRulesDoctorActiveIdx" ON "doctor_schedule_rules" USING btree ("doctorId","isActive");
--> statement-breakpoint
CREATE INDEX "doctorScheduleExceptionsDoctorDateIdx" ON "doctor_schedule_exceptions" USING btree ("doctorId","dateLocal");
--> statement-breakpoint
CREATE INDEX "doctorSlotsDoctorLocalDateIdx" ON "doctor_slots" USING btree ("doctorId","localDate");
--> statement-breakpoint
CREATE INDEX "doctorSlotsStatusStartIdx" ON "doctor_slots" USING btree ("status","startAt");
--> statement-breakpoint
CREATE INDEX "doctorSlotsHoldExpiresIdx" ON "doctor_slots" USING btree ("holdExpiresAt");
--> statement-breakpoint
CREATE INDEX "doctorSlotsAppointmentIdx" ON "doctor_slots" USING btree ("appointmentId");
--> statement-breakpoint
CREATE UNIQUE INDEX "doctorSlotsDoctorTypeStartUk" ON "doctor_slots" USING btree ("doctorId","appointmentType","startAt");
--> statement-breakpoint
CREATE INDEX "appointmentsSlotIdx" ON "appointments" USING btree ("slotId");
