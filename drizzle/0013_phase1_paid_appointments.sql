ALTER TABLE `ai_chat_sessions` ADD COLUMN `summary` text;--> statement-breakpoint
ALTER TABLE `ai_chat_sessions` ADD COLUMN `summaryGeneratedAt` timestamp;--> statement-breakpoint
ALTER TABLE `appointments` ADD COLUMN `triageSessionId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD COLUMN `paymentStatus` enum('unpaid','pending','paid','failed','expired','refunded') NOT NULL DEFAULT 'unpaid';--> statement-breakpoint
ALTER TABLE `appointments` ADD COLUMN `stripeSessionId` varchar(255);--> statement-breakpoint
ALTER TABLE `appointments` ADD COLUMN `amount` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `appointments` ADD COLUMN `currency` varchar(8) NOT NULL DEFAULT 'usd';--> statement-breakpoint
ALTER TABLE `appointments` ADD COLUMN `paidAt` timestamp;--> statement-breakpoint
ALTER TABLE `appointments` MODIFY COLUMN `status` enum('draft','pending_payment','paid','confirmed','in_session','completed','expired','refunded') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `appointments` MODIFY COLUMN `accessTokenHash` varchar(128);--> statement-breakpoint
ALTER TABLE `appointments` MODIFY COLUMN `accessTokenExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_triageSessionId_ai_chat_sessions_id_fk` FOREIGN KEY (`triageSessionId`) REFERENCES `ai_chat_sessions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `triageSessionIdx` ON `appointments` (`triageSessionId`);--> statement-breakpoint
CREATE UNIQUE INDEX `appointmentsStripeSessionIdUk` ON `appointments` (`stripeSessionId`);--> statement-breakpoint
ALTER TABLE `appointmentMessages` ADD COLUMN `originalContent` text;--> statement-breakpoint
ALTER TABLE `appointmentMessages` ADD COLUMN `translatedContent` text;--> statement-breakpoint
ALTER TABLE `appointmentMessages` ADD COLUMN `sourceLanguage` varchar(8);--> statement-breakpoint
ALTER TABLE `appointmentMessages` ADD COLUMN `targetLanguage` varchar(8);--> statement-breakpoint
ALTER TABLE `appointmentMessages` ADD COLUMN `translationProvider` varchar(64);--> statement-breakpoint
CREATE TABLE `appointment_status_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` int NOT NULL,
	`fromStatus` varchar(64),
	`toStatus` varchar(64) NOT NULL,
	`operatorType` enum('system','patient','doctor','admin','webhook') NOT NULL,
	`operatorId` int,
	`reason` text,
	`payloadJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `appointment_status_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `appointment_status_events` ADD CONSTRAINT `appointment_status_events_appointmentId_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `appointmentStatusEventsAppointmentIdx` ON `appointment_status_events` (`appointmentId`);--> statement-breakpoint
CREATE INDEX `appointmentStatusEventsCreatedAtIdx` ON `appointment_status_events` (`createdAt`);
