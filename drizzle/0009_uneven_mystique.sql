CREATE TABLE "referral_notification_outbox" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "referral_notification_outbox_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"orderId" integer NOT NULL,
	"eventType" varchar(64) NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"recipientType" text NOT NULL,
	"recipient" varchar(320) NOT NULL,
	"language" varchar(8) DEFAULT 'zh' NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attemptCount" integer DEFAULT 0 NOT NULL,
	"nextAttemptAt" timestamp DEFAULT now() NOT NULL,
	"processingStartedAt" timestamp,
	"lastError" text,
	"sentAt" timestamp,
	"dedupeKey" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "referral_orders" ALTER COLUMN "currency" SET DEFAULT 'cny';--> statement-breakpoint
ALTER TABLE "referral_orders" ALTER COLUMN "agreementVersion" SET DEFAULT 'referral_service_v2';--> statement-breakpoint
ALTER TABLE "referral_orders" ADD COLUMN "clientRequestId" varchar(64);--> statement-breakpoint
ALTER TABLE "referral_orders" ADD COLUMN "fulfillmentDeadlineAt" timestamp;--> statement-breakpoint
ALTER TABLE "referral_orders" ADD COLUMN "consultationTimeZone" varchar(64);--> statement-breakpoint
ALTER TABLE "referral_orders" ADD COLUMN "consultationProviderName" varchar(255);--> statement-breakpoint
ALTER TABLE "referral_orders" ADD COLUMN "consultationPlatform" varchar(120);--> statement-breakpoint
ALTER TABLE "referral_orders" ADD COLUMN "consultationJoinUrl" varchar(1024);--> statement-breakpoint
ALTER TABLE "referral_orders" ADD COLUMN "consultationInstructions" text;--> statement-breakpoint
ALTER TABLE "referral_orders" ADD COLUMN "paymentProviderTransactionId" varchar(255);--> statement-breakpoint
ALTER TABLE "referral_orders" ADD COLUMN "paymentProviderRefundId" varchar(255);--> statement-breakpoint
ALTER TABLE "stripe_webhook_events" ADD COLUMN "resourceType" varchar(64);--> statement-breakpoint
ALTER TABLE "stripe_webhook_events" ADD COLUMN "resourceId" integer;--> statement-breakpoint
ALTER TABLE "referral_notification_outbox" ADD CONSTRAINT "referral_notification_outbox_orderId_referral_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."referral_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "referralNotificationOutboxDedupeUk" ON "referral_notification_outbox" USING btree ("dedupeKey");--> statement-breakpoint
CREATE INDEX "referralNotificationOutboxPendingIdx" ON "referral_notification_outbox" USING btree ("status","nextAttemptAt");--> statement-breakpoint
CREATE INDEX "referralNotificationOutboxOrderIdx" ON "referral_notification_outbox" USING btree ("orderId");--> statement-breakpoint
CREATE UNIQUE INDEX "referralOrdersPatientRequestUk" ON "referral_orders" USING btree ("patientUserId","clientRequestId");--> statement-breakpoint
CREATE INDEX "referralOrdersFulfillmentDeadlineIdx" ON "referral_orders" USING btree ("status","fulfillmentDeadlineAt");
