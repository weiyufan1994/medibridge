CREATE TABLE `doctor_specialty_tags` (
  `id` int AUTO_INCREMENT NOT NULL,
  `doctorId` int NOT NULL,
  `tag` varchar(64) NOT NULL,
  `source` varchar(32) NOT NULL DEFAULT 'rule',
  `confidence` int NOT NULL DEFAULT 100,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `doctor_specialty_tags_id` PRIMARY KEY(`id`),
  CONSTRAINT `doctor_specialty_tags_doctorId_doctors_id_fk`
    FOREIGN KEY (`doctorId`) REFERENCES `doctors`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX `doctorSpecialtyTagsDoctorIdx` ON `doctor_specialty_tags` (`doctorId`);
--> statement-breakpoint
CREATE INDEX `doctorSpecialtyTagsTagIdx` ON `doctor_specialty_tags` (`tag`);
--> statement-breakpoint
CREATE UNIQUE INDEX `doctorSpecialtyTagsDoctorTagUk` ON `doctor_specialty_tags` (`doctorId`,`tag`);
