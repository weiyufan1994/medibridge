CREATE TABLE `ai_chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_chat_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`status` enum('active','completed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_chat_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `isGuest` tinyint NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `ai_chat_messages` ADD CONSTRAINT `ai_chat_messages_sessionId_ai_chat_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `ai_chat_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_chat_sessions` ADD CONSTRAINT `ai_chat_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `aiChatMessagesSessionIdx` ON `ai_chat_messages` (`sessionId`);--> statement-breakpoint
CREATE INDEX `aiChatMessagesCreatedAtIdx` ON `ai_chat_messages` (`createdAt`);--> statement-breakpoint
CREATE INDEX `aiChatSessionsUserIdx` ON `ai_chat_sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `aiChatSessionsStatusIdx` ON `ai_chat_sessions` (`status`);