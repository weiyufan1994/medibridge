CREATE TABLE IF NOT EXISTS `appointment_visit_summaries` (
  `id` int AUTO_INCREMENT NOT NULL,
  `appointmentId` int NOT NULL,
  `summaryZh` text NOT NULL,
  `summaryEn` text NOT NULL,
  `source` varchar(32) NOT NULL DEFAULT 'llm',
  `generatedBy` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `appointment_visit_summaries_id` PRIMARY KEY(`id`),
  CONSTRAINT `appointmentVisitSummariesAppointmentUk` UNIQUE(`appointmentId`)
);
--> statement-breakpoint
CREATE INDEX `appointmentVisitSummariesCreatedAtIdx` ON `appointment_visit_summaries` (`createdAt`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `visit_retention_policies` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tier` enum('free','paid') NOT NULL,
  `retentionDays` int NOT NULL,
  `enabled` tinyint NOT NULL DEFAULT 1,
  `updatedBy` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `visit_retention_policies_id` PRIMARY KEY(`id`),
  CONSTRAINT `visitRetentionPoliciesTierUk` UNIQUE(`tier`)
);
--> statement-breakpoint
INSERT INTO `visit_retention_policies` (`tier`, `retentionDays`, `enabled`)
VALUES
  ('free', 7, 1),
  ('paid', 180, 1)
ON DUPLICATE KEY UPDATE `tier` = VALUES(`tier`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `retention_cleanup_audits` (
  `id` int AUTO_INCREMENT NOT NULL,
  `dryRun` tinyint NOT NULL DEFAULT 0,
  `freeRetentionDays` int NOT NULL,
  `paidRetentionDays` int NOT NULL,
  `scannedMessages` int NOT NULL DEFAULT 0,
  `deletedMessages` int NOT NULL DEFAULT 0,
  `detailsJson` json,
  `createdBy` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `retention_cleanup_audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `retentionCleanupAuditsCreatedAtIdx` ON `retention_cleanup_audits` (`createdAt`);
--> statement-breakpoint

ALTER TABLE `appointment_visit_summaries` ADD CONSTRAINT `appointment_visit_summaries_appointmentId_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `appointment_visit_summaries` ADD CONSTRAINT `appointment_visit_summaries_generatedBy_users_id_fk` FOREIGN KEY (`generatedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('free','pro','admin') NOT NULL DEFAULT 'free';
--> statement-breakpoint
ALTER TABLE `visit_retention_policies` ADD CONSTRAINT `visit_retention_policies_updatedBy_users_id_fk` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `retention_cleanup_audits` ADD CONSTRAINT `retention_cleanup_audits_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
