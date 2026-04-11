CREATE TABLE "referral_contacts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "referral_contacts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"hospitalId" integer NOT NULL,
	"departmentId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"roleType" varchar(120) NOT NULL,
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"specialtyTags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"avgResponseTimeMinutes" integer,
	"successRate" integer,
	"isActive" integer DEFAULT 1 NOT NULL,
	"internalNotes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_order_operations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "referral_order_operations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"orderId" integer NOT NULL,
	"operatorType" text NOT NULL,
	"operatorId" integer,
	"actionType" varchar(64) NOT NULL,
	"actionPayload" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_order_status_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "referral_order_status_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"orderId" integer NOT NULL,
	"fromStatus" varchar(64),
	"toStatus" varchar(64) NOT NULL,
	"actorType" text NOT NULL,
	"actorId" integer,
	"reason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "referral_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"patientUserId" integer NOT NULL,
	"triageSessionId" integer NOT NULL,
	"hospitalId" integer NOT NULL,
	"departmentId" integer NOT NULL,
	"contactId" integer NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"paymentStatus" text DEFAULT 'unpaid' NOT NULL,
	"totalAmount" integer DEFAULT 19900 NOT NULL,
	"currency" varchar(8) DEFAULT 'usd' NOT NULL,
	"assignedAgentId" integer,
	"caseSummarySnapshot" text,
	"consultationTime" timestamp,
	"refundReason" text,
	"agreementAcceptedAt" timestamp NOT NULL,
	"agreementVersion" varchar(32) DEFAULT 'referral_service_v1' NOT NULL,
	"agreementLang" varchar(8) DEFAULT 'zh' NOT NULL,
	"paymentProvider" text DEFAULT 'stripe' NOT NULL,
	"paymentProviderSessionId" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"paidAt" timestamp,
	"completedAt" timestamp,
	"refundedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "refund_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "refund_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"orderId" integer NOT NULL,
	"reasonCode" text NOT NULL,
	"reasonDetail" text,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"requestedBy" integer,
	"reviewedBy" integer,
	"approvedAt" timestamp,
	"refundedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "isActive" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "hospitals" ADD COLUMN "isActive" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "referral_contacts" ADD CONSTRAINT "referral_contacts_hospitalId_hospitals_id_fk" FOREIGN KEY ("hospitalId") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_contacts" ADD CONSTRAINT "referral_contacts_departmentId_departments_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_order_operations" ADD CONSTRAINT "referral_order_operations_orderId_referral_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."referral_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_order_operations" ADD CONSTRAINT "referral_order_operations_operatorId_users_id_fk" FOREIGN KEY ("operatorId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_order_status_events" ADD CONSTRAINT "referral_order_status_events_orderId_referral_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."referral_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_order_status_events" ADD CONSTRAINT "referral_order_status_events_actorId_users_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_orders" ADD CONSTRAINT "referral_orders_patientUserId_users_id_fk" FOREIGN KEY ("patientUserId") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_orders" ADD CONSTRAINT "referral_orders_triageSessionId_ai_chat_sessions_id_fk" FOREIGN KEY ("triageSessionId") REFERENCES "public"."ai_chat_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_orders" ADD CONSTRAINT "referral_orders_hospitalId_hospitals_id_fk" FOREIGN KEY ("hospitalId") REFERENCES "public"."hospitals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_orders" ADD CONSTRAINT "referral_orders_departmentId_departments_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_orders" ADD CONSTRAINT "referral_orders_contactId_referral_contacts_id_fk" FOREIGN KEY ("contactId") REFERENCES "public"."referral_contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_orders" ADD CONSTRAINT "referral_orders_assignedAgentId_users_id_fk" FOREIGN KEY ("assignedAgentId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_orderId_referral_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."referral_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_requestedBy_users_id_fk" FOREIGN KEY ("requestedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_reviewedBy_users_id_fk" FOREIGN KEY ("reviewedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referralContactsHospitalIdx" ON "referral_contacts" USING btree ("hospitalId");--> statement-breakpoint
CREATE INDEX "referralContactsDepartmentIdx" ON "referral_contacts" USING btree ("departmentId");--> statement-breakpoint
CREATE INDEX "referralContactsActiveIdx" ON "referral_contacts" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "referralOrderOperationsOrderIdx" ON "referral_order_operations" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "referralOrderOperationsCreatedAtIdx" ON "referral_order_operations" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "referralOrderStatusEventsOrderIdx" ON "referral_order_status_events" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "referralOrderStatusEventsCreatedAtIdx" ON "referral_order_status_events" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "referralOrdersPatientIdx" ON "referral_orders" USING btree ("patientUserId");--> statement-breakpoint
CREATE INDEX "referralOrdersTriageSessionIdx" ON "referral_orders" USING btree ("triageSessionId");--> statement-breakpoint
CREATE INDEX "referralOrdersHospitalIdx" ON "referral_orders" USING btree ("hospitalId");--> statement-breakpoint
CREATE INDEX "referralOrdersContactIdx" ON "referral_orders" USING btree ("contactId");--> statement-breakpoint
CREATE INDEX "referralOrdersStatusIdx" ON "referral_orders" USING btree ("status","updatedAt");--> statement-breakpoint
CREATE INDEX "referralOrdersAssignedAgentIdx" ON "referral_orders" USING btree ("assignedAgentId");--> statement-breakpoint
CREATE UNIQUE INDEX "referralOrdersPaymentSessionUk" ON "referral_orders" USING btree ("paymentProviderSessionId");--> statement-breakpoint
CREATE INDEX "refundRequestsOrderIdx" ON "refund_requests" USING btree ("orderId");--> statement-breakpoint
CREATE INDEX "refundRequestsStatusIdx" ON "refund_requests" USING btree ("status","updatedAt");
