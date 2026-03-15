CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
ALTER TABLE "doctorEmbeddings"
ADD COLUMN "embeddingVector" vector(1024);
--> statement-breakpoint
UPDATE "doctorEmbeddings"
SET "embeddingVector" = ("embedding"::text)::vector
WHERE "embeddingVector" IS NULL;
--> statement-breakpoint
ALTER TABLE "doctorEmbeddings"
ALTER COLUMN "embeddingVector" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX "doctorEmbeddingsVectorIdx"
ON "doctorEmbeddings"
USING hnsw ("embeddingVector" vector_cosine_ops);
