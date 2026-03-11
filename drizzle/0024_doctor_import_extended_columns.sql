ALTER TABLE `doctors` ADD COLUMN IF NOT EXISTS `sourceDoctorId` varchar(128) NULL;
--> statement-breakpoint
ALTER TABLE `doctors` ADD COLUMN IF NOT EXISTS `totalPatients` varchar(100) NULL;
--> statement-breakpoint
ALTER TABLE `doctors` ADD COLUMN IF NOT EXISTS `totalArticles` varchar(100) NULL;
--> statement-breakpoint
ALTER TABLE `doctors` ADD COLUMN IF NOT EXISTS `totalVisits` varchar(100) NULL;
--> statement-breakpoint
ALTER TABLE `doctors` ADD COLUMN IF NOT EXISTS `scrapedDate` varchar(100) NULL;
--> statement-breakpoint
ALTER TABLE `doctors` ADD COLUMN IF NOT EXISTS `scrapedStatus` varchar(64) NULL;
--> statement-breakpoint
ALTER TABLE `doctors` ADD COLUMN IF NOT EXISTS `dataSource` varchar(255) NULL;
--> statement-breakpoint
ALTER TABLE `doctors` ADD COLUMN IF NOT EXISTS `educationExperience` text NULL;
--> statement-breakpoint
ALTER TABLE `doctors` ADD COLUMN IF NOT EXISTS `socialRole` text NULL;
--> statement-breakpoint
ALTER TABLE `doctors` ADD COLUMN IF NOT EXISTS `researchAchievements` text NULL;
--> statement-breakpoint
ALTER TABLE `doctors` ADD COLUMN IF NOT EXISTS `honors` text NULL;
--> statement-breakpoint
ALTER TABLE `doctors` ADD COLUMN IF NOT EXISTS `followUpPatients` varchar(100) NULL;
--> statement-breakpoint
ALTER TABLE `doctors` ADD COLUMN IF NOT EXISTS `followUpFeedback` text NULL;
--> statement-breakpoint
ALTER TABLE `doctors` ADD COLUMN IF NOT EXISTS `gender` varchar(20) NULL;
--> statement-breakpoint
ALTER TABLE `doctors` ADD COLUMN IF NOT EXISTS `sequenceNumber` int NULL;
