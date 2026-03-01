CREATE TABLE `appointmentMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` int NOT NULL,
	`senderType` enum('patient','doctor','system') NOT NULL,
	`content` text NOT NULL,
	`clientMsgId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `appointmentMessages_id` PRIMARY KEY(`id`),
	CONSTRAINT `appointmentMessagesAppointmentClientMsgUk` UNIQUE(`appointmentId`,`clientMsgId`)
);
--> statement-breakpoint
CREATE INDEX `appointmentMessagesAppointmentIdx` ON `appointmentMessages` (`appointmentId`);--> statement-breakpoint
CREATE INDEX `appointmentMessagesCreatedAtIdx` ON `appointmentMessages` (`createdAt`);
