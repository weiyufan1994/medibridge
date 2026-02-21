ALTER TABLE `departments` ADD `descriptionEn` text;--> statement-breakpoint
ALTER TABLE `departments` ADD `sourceHash` varchar(64);--> statement-breakpoint
ALTER TABLE `departments` ADD `translationStatus` enum('pending','done','failed') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `departments` ADD `translatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `departments` ADD `lastTranslationError` text;--> statement-breakpoint
ALTER TABLE `departments` ADD `translationProvider` varchar(100);--> statement-breakpoint
ALTER TABLE `doctors` ADD `titleEn` varchar(100);--> statement-breakpoint
ALTER TABLE `doctors` ADD `satisfactionRateEn` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `attitudeScoreEn` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `onlineConsultationEn` varchar(50);--> statement-breakpoint
ALTER TABLE `doctors` ADD `appointmentAvailableEn` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `sourceHash` varchar(64);--> statement-breakpoint
ALTER TABLE `doctors` ADD `translationStatus` enum('pending','done','failed') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `doctors` ADD `translatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `doctors` ADD `lastTranslationError` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `translationProvider` varchar(100);--> statement-breakpoint
ALTER TABLE `hospitals` ADD `cityEn` varchar(100);--> statement-breakpoint
ALTER TABLE `hospitals` ADD `levelEn` varchar(50);--> statement-breakpoint
ALTER TABLE `hospitals` ADD `addressEn` text;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `descriptionEn` text;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `sourceHash` varchar(64);--> statement-breakpoint
ALTER TABLE `hospitals` ADD `translationStatus` enum('pending','done','failed') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `hospitals` ADD `translatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `lastTranslationError` text;--> statement-breakpoint
ALTER TABLE `hospitals` ADD `translationProvider` varchar(100);