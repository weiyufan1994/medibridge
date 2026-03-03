CREATE TABLE `appointmentTokens` (
  `id` int AUTO_INCREMENT NOT NULL,
  `appointmentId` int NOT NULL,
  `role` enum('patient','doctor') NOT NULL,
  `tokenHash` varchar(128) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `revokedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `appointmentTokens_id` PRIMARY KEY(`id`),
  CONSTRAINT `appointmentTokens_appointmentId_appointments_id_fk`
    FOREIGN KEY (`appointmentId`) REFERENCES `appointments`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX `appointmentTokensAppointmentRoleIdx` ON `appointmentTokens` (`appointmentId`,`role`);
--> statement-breakpoint
CREATE INDEX `appointmentTokensAppointmentExpiryIdx` ON `appointmentTokens` (`appointmentId`,`expiresAt`);
--> statement-breakpoint
CREATE INDEX `appointmentTokensTokenHashIdx` ON `appointmentTokens` (`tokenHash`);
