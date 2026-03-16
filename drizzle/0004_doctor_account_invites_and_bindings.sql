CREATE TABLE "doctor_user_bindings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "doctor_user_bindings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doctorId" integer NOT NULL,
	"userId" integer NOT NULL,
	"email" varchar(320) NOT NULL,
	"status" text DEFAULT 'pending_invite' NOT NULL,
	"boundAt" timestamp,
	"revokedAt" timestamp,
	"createdByUserId" integer,
	"updatedByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctor_account_invites" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "doctor_account_invites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doctorId" integer NOT NULL,
	"email" varchar(320) NOT NULL,
	"tokenHash" varchar(64) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"sentAt" timestamp,
	"acceptedAt" timestamp,
	"createdByUserId" integer,
	"claimedByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "doctor_user_bindings" ADD CONSTRAINT "doctor_user_bindings_doctorId_doctors_id_fk" FOREIGN KEY ("doctorId") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "doctor_user_bindings" ADD CONSTRAINT "doctor_user_bindings_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "doctor_user_bindings" ADD CONSTRAINT "doctor_user_bindings_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "doctor_user_bindings" ADD CONSTRAINT "doctor_user_bindings_updatedByUserId_users_id_fk" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "doctor_account_invites" ADD CONSTRAINT "doctor_account_invites_doctorId_doctors_id_fk" FOREIGN KEY ("doctorId") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "doctor_account_invites" ADD CONSTRAINT "doctor_account_invites_createdByUserId_users_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "doctor_account_invites" ADD CONSTRAINT "doctor_account_invites_claimedByUserId_users_id_fk" FOREIGN KEY ("claimedByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "doctorUserBindingsDoctorIdx" ON "doctor_user_bindings" USING btree ("doctorId");
--> statement-breakpoint
CREATE INDEX "doctorUserBindingsUserIdx" ON "doctor_user_bindings" USING btree ("userId");
--> statement-breakpoint
CREATE INDEX "doctorUserBindingsStatusIdx" ON "doctor_user_bindings" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "doctorUserBindingsEmailIdx" ON "doctor_user_bindings" USING btree ("email");
--> statement-breakpoint
CREATE INDEX "doctorAccountInvitesDoctorIdx" ON "doctor_account_invites" USING btree ("doctorId");
--> statement-breakpoint
CREATE INDEX "doctorAccountInvitesEmailIdx" ON "doctor_account_invites" USING btree ("email");
--> statement-breakpoint
CREATE INDEX "doctorAccountInvitesStatusIdx" ON "doctor_account_invites" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "doctorAccountInvitesExpiresIdx" ON "doctor_account_invites" USING btree ("expiresAt");
--> statement-breakpoint
CREATE UNIQUE INDEX "doctorAccountInvitesTokenHashUk" ON "doctor_account_invites" USING btree ("tokenHash");
--> statement-breakpoint
CREATE UNIQUE INDEX "doctorUserBindingsDoctorActiveUk" ON "doctor_user_bindings" USING btree ("doctorId") WHERE "status" = 'active';
--> statement-breakpoint
CREATE UNIQUE INDEX "doctorUserBindingsUserActiveUk" ON "doctor_user_bindings" USING btree ("userId") WHERE "status" = 'active';
