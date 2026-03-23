import "../server/_core/loadEnv";
import fs from "node:fs";
import path from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  triageKnowledgeChunks,
  triageKnowledgeDocuments,
} from "../drizzle/schema";
import { createEmbedding } from "../server/_core/llm";

type SeedCard = {
  title: string;
  body: string;
  keywords: string[];
  specialtyTags: string[];
  riskCodes: string[];
};

const KNOWLEDGE_VERSION = "v1";
const KNOWLEDGE_LANG = "zh";

function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  return process.env.DATABASE_URL;
}

async function main() {
  const pool = new Pool({
    connectionString: requireDatabaseUrl(),
  });
  const db = drizzle(pool);

  const filePath = path.resolve("scripts/data/triage-knowledge.seed.json");
  const cards = JSON.parse(fs.readFileSync(filePath, "utf8")) as SeedCard[];

  console.log(`Importing ${cards.length} triage knowledge cards...`);

  for (const [index, card] of cards.entries()) {
    const existing = await db
      .select({ id: triageKnowledgeDocuments.id })
      .from(triageKnowledgeDocuments)
      .where(
        and(
          eq(triageKnowledgeDocuments.title, card.title),
          eq(triageKnowledgeDocuments.version, KNOWLEDGE_VERSION)
        )
      )
      .limit(1);

    let documentId = existing[0]?.id;
    if (!documentId) {
      const inserted = await db
        .insert(triageKnowledgeDocuments)
        .values({
          sourceType: "internal_card",
          title: card.title,
          lang: KNOWLEDGE_LANG,
          body: card.body,
          version: KNOWLEDGE_VERSION,
          status: "active",
        })
        .returning({ id: triageKnowledgeDocuments.id });
      documentId = inserted[0]?.id;
    } else {
      await db
        .update(triageKnowledgeDocuments)
        .set({
          body: card.body,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(triageKnowledgeDocuments.id, documentId));

      await db
        .delete(triageKnowledgeChunks)
        .where(eq(triageKnowledgeChunks.documentId, documentId));
    }

    if (!documentId) {
      throw new Error(`Failed to resolve knowledge document id for ${card.title}`);
    }

    const embedding = await createEmbedding(card.body);
    await db.insert(triageKnowledgeChunks).values({
      documentId,
      chunkIndex: 0,
      title: card.title,
      content: card.body,
      keywords: card.keywords,
      specialtyTags: card.specialtyTags,
      riskCodes: card.riskCodes,
      embeddingVector: embedding,
      embeddingModel: process.env.LLM_EMBEDDING_MODEL ?? process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: embedding.length,
    });

    console.log(`  [${index + 1}/${cards.length}] imported ${card.title}`);
  }

  const counts = await db.execute(sql`
    select
      (select count(*) from triage_knowledge_documents) as document_count,
      (select count(*) from triage_knowledge_chunks) as chunk_count
  `);
  console.log("Import completed:", counts.rows[0]);
  await pool.end();
}

main().catch(error => {
  console.error("[import-triage-knowledge] failed:", error);
  process.exit(1);
});
