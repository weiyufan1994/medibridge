ALTER TABLE `doctors` ADD `experience` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `description` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `imageUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `doctors` ADD CONSTRAINT `doctorHospitalDepartmentNameUk` UNIQUE(`hospitalId`,`departmentId`,`name`);