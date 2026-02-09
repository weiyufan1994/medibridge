CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64),
	`userId` int,
	`doctorId` int NOT NULL,
	`appointmentType` enum('online_chat','video_call','in_person') NOT NULL,
	`scheduledAt` timestamp,
	`status` enum('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hospitalId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `departments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `doctorEmbeddings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`doctorId` int NOT NULL,
	`embedding` json NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `doctorEmbeddings_id` PRIMARY KEY(`id`),
	CONSTRAINT `doctorEmbeddings_doctorId_unique` UNIQUE(`doctorId`)
);
--> statement-breakpoint
CREATE TABLE `doctors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hospitalId` int NOT NULL,
	`departmentId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`nameEn` varchar(100),
	`title` varchar(100),
	`specialty` varchar(255),
	`expertise` text,
	`satisfactionRate` varchar(50),
	`attitudeScore` varchar(50),
	`recommendationScore` float,
	`onlineConsultation` varchar(50),
	`appointmentAvailable` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `doctors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hospitals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameEn` varchar(255),
	`city` varchar(100) NOT NULL DEFAULT '上海',
	`level` varchar(50) DEFAULT '三级甲等',
	`address` text,
	`contact` varchar(100),
	`website` varchar(255),
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hospitals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patientSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`userId` int,
	`chatHistory` json NOT NULL,
	`symptoms` text,
	`duration` varchar(100),
	`age` int,
	`medicalHistory` text,
	`recommendedDoctors` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patientSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `patientSessions_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE INDEX `doctorIdx` ON `appointments` (`doctorId`);--> statement-breakpoint
CREATE INDEX `userIdx` ON `appointments` (`userId`);--> statement-breakpoint
CREATE INDEX `sessionIdx` ON `appointments` (`sessionId`);--> statement-breakpoint
CREATE INDEX `hospitalIdx` ON `departments` (`hospitalId`);--> statement-breakpoint
CREATE INDEX `doctorIdx` ON `doctorEmbeddings` (`doctorId`);--> statement-breakpoint
CREATE INDEX `hospitalIdx` ON `doctors` (`hospitalId`);--> statement-breakpoint
CREATE INDEX `departmentIdx` ON `doctors` (`departmentId`);--> statement-breakpoint
CREATE INDEX `recommendationIdx` ON `doctors` (`recommendationScore`);--> statement-breakpoint
CREATE INDEX `sessionIdx` ON `patientSessions` (`sessionId`);--> statement-breakpoint
CREATE INDEX `userIdx` ON `patientSessions` (`userId`);