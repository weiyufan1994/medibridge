ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('free','pro') NOT NULL DEFAULT 'free';--> statement-breakpoint
ALTER TABLE `appointmentMessages` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `isGuest` tinyint DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `deviceId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_deviceId_unique` UNIQUE(`deviceId`);--> statement-breakpoint
ALTER TABLE `appointmentMessages` ADD CONSTRAINT `appointmentMessages_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patientSessions` ADD CONSTRAINT `patientSessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `appointmentMessagesUserIdx` ON `appointmentMessages` (`userId`);