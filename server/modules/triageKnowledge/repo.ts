import { and, asc, desc, ilike, inArray, or, sql } from "drizzle-orm";
import {
  triageKnowledgeChunks,
  triageKnowledgeDocuments,
} from "../../../drizzle/schema";
import { getDb } from "../../db";
import type { KnowledgeHit } from "./types";

const MAX_KEYWORD_CANDIDATES = 5;

const eqActive = () =>
  and(
    sql`${triageKnowledgeDocuments.status} = 'active'`,
    sql`${triageKnowledgeDocuments.lang} = 'zh'`
  );

const mapRowToHit = (row: {
  chunk: typeof triageKnowledgeChunks.$inferSelect;
  document: typeof triageKnowledgeDocuments.$inferSelect;
  score?: number;
}): KnowledgeHit => ({
  chunkId: row.chunk.id,
  documentId: row.document.id,
  documentTitle: row.document.title,
  chunkIndex: row.chunk.chunkIndex,
  title: row.chunk.title,
  content: row.chunk.content,
  riskCodes: row.chunk.riskCodes ?? [],
  specialtyTags: row.chunk.specialtyTags ?? [],
  score: row.score,
});

export async function keywordSearch(terms: string[], limit = MAX_KEYWORD_CANDIDATES) {
  const db = await getDb();
  if (!db || terms.length === 0) {
    return [] as KnowledgeHit[];
  }

  const conditions = terms.flatMap(term => [
    ilike(triageKnowledgeDocuments.title, `%${term}%`),
    ilike(triageKnowledgeChunks.title, `%${term}%`),
    ilike(triageKnowledgeChunks.content, `%${term}%`),
  ]);

  const rows = await db
    .select({
      chunk: triageKnowledgeChunks,
      document: triageKnowledgeDocuments,
    })
    .from(triageKnowledgeChunks)
    .innerJoin(
      triageKnowledgeDocuments,
      sql`${triageKnowledgeChunks.documentId} = ${triageKnowledgeDocuments.id}`
    )
    .where(
      and(
        eqActive(),
        conditions.length > 0 ? or(...conditions) : undefined
      )
    )
    .orderBy(asc(triageKnowledgeChunks.chunkIndex), desc(triageKnowledgeChunks.id))
    .limit(limit);

  return rows.map(mapRowToHit);
}

const vectorLiteral = (vector: number[]) =>
  sql.raw(`'[${vector.map(value => Number(value).toFixed(8)).join(",")}]'::vector`);

export async function semanticSearch(queryEmbedding: number[], limit = MAX_KEYWORD_CANDIDATES) {
  const db = await getDb();
  if (!db || queryEmbedding.length === 0) {
    return [] as KnowledgeHit[];
  }

  const similarity = sql<number>`1 - (${triageKnowledgeChunks.embeddingVector} <=> ${vectorLiteral(queryEmbedding)})`;
  const rows = await db
    .select({
      chunk: triageKnowledgeChunks,
      document: triageKnowledgeDocuments,
      score: similarity,
    })
    .from(triageKnowledgeChunks)
    .innerJoin(
      triageKnowledgeDocuments,
      sql`${triageKnowledgeChunks.documentId} = ${triageKnowledgeDocuments.id}`
    )
    .where(
      and(
        eqActive(),
        sql`${triageKnowledgeChunks.embeddingVector} is not null`
      )
    )
    .orderBy(desc(similarity))
    .limit(limit);

  return rows.map(mapRowToHit);
}

export async function readChunks(chunkIds: number[]) {
  const db = await getDb();
  if (!db || chunkIds.length === 0) {
    return [] as KnowledgeHit[];
  }

  const rows = await db
    .select({
      chunk: triageKnowledgeChunks,
      document: triageKnowledgeDocuments,
    })
    .from(triageKnowledgeChunks)
    .innerJoin(
      triageKnowledgeDocuments,
      sql`${triageKnowledgeChunks.documentId} = ${triageKnowledgeDocuments.id}`
    )
    .where(inArray(triageKnowledgeChunks.id, chunkIds))
    .orderBy(asc(triageKnowledgeChunks.chunkIndex));

  return rows.map(mapRowToHit);
}
