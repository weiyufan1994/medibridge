ALTER TABLE "doctorEmbeddings"
ADD COLUMN "embeddingModel" varchar(128);
--> statement-breakpoint
ALTER TABLE "doctorEmbeddings"
ADD COLUMN "embeddingDimensions" integer;
--> statement-breakpoint
UPDATE "doctorEmbeddings"
SET
  "embeddingModel" = 'BAAI/bge-m3',
  "embeddingDimensions" = 1024
WHERE "embeddingModel" IS NULL
   OR "embeddingDimensions" IS NULL;
--> statement-breakpoint
ALTER TABLE "doctorEmbeddings"
ALTER COLUMN "embeddingModel" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "doctorEmbeddings"
ALTER COLUMN "embeddingDimensions" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "doctorEmbeddings"
DROP COLUMN "embedding";
