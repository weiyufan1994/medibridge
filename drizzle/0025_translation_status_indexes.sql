ALTER TABLE `hospitals` ADD INDEX IF NOT EXISTS `hospitalsTranslationStatusIdx` (`translationStatus`);
--> statement-breakpoint
ALTER TABLE `hospitals` ADD INDEX IF NOT EXISTS `hospitalsTranslationStatusIdIdx` (`translationStatus`, `id`);
--> statement-breakpoint
ALTER TABLE `departments` ADD INDEX IF NOT EXISTS `departmentsTranslationStatusIdx` (`translationStatus`);
--> statement-breakpoint
ALTER TABLE `departments` ADD INDEX IF NOT EXISTS `departmentsTranslationStatusIdIdx` (`translationStatus`, `id`);
--> statement-breakpoint
ALTER TABLE `doctors` ADD INDEX IF NOT EXISTS `doctorsTranslationStatusIdx` (`translationStatus`);
--> statement-breakpoint
ALTER TABLE `doctors` ADD INDEX IF NOT EXISTS `doctorsTranslationStatusIdIdx` (`translationStatus`, `id`);
