CREATE TABLE IF NOT EXISTS `appointment_medical_summaries` (
  `id` int AUTO_INCREMENT NOT NULL,
  `appointmentId` int NOT NULL,
  `chiefComplaint` text NOT NULL,
  `historyOfPresentIllness` text NOT NULL,
  `pastMedicalHistory` text NOT NULL,
  `assessmentDiagnosis` text NOT NULL,
  `planRecommendations` text NOT NULL,
  `source` varchar(32) NOT NULL DEFAULT 'doctor_reviewed_ai_draft',
  `signedBy` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `appointment_medical_summaries_id` PRIMARY KEY(`id`),
  CONSTRAINT `appointmentMedicalSummariesAppointmentUk` UNIQUE(`appointmentId`)
);
--> statement-breakpoint
CREATE INDEX `appointmentMedicalSummariesCreatedAtIdx` ON `appointment_medical_summaries` (`createdAt`);
--> statement-breakpoint
ALTER TABLE `appointment_medical_summaries` ADD CONSTRAINT `appointment_medical_summaries_appointmentId_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `appointment_medical_summaries` ADD CONSTRAINT `appointment_medical_summaries_signedBy_users_id_fk` FOREIGN KEY (`signedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `appointments` MODIFY COLUMN `status` enum('draft','pending_payment','paid','active','ended','completed','expired','refunded','canceled') NOT NULL DEFAULT 'draft';
