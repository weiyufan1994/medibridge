import { readChunk } from "./chunkReader";
import { keywordSearch } from "./keywordSearch";
import { semanticSearch } from "./semanticSearch";
import type { KnowledgeHit, RetrievalMode, TriageKnowledgeContext } from "./types";

const MAX_FINAL_SNIPPETS = 3;

const dedupeHits = (hits: KnowledgeHit[]) => {
  const byChunkId = new Map<number, KnowledgeHit>();
  for (const hit of hits) {
    if (!byChunkId.has(hit.chunkId)) {
      byChunkId.set(hit.chunkId, hit);
    }
  }
  return Array.from(byChunkId.values());
};

const toKnowledgeContext = (
  hits: KnowledgeHit[],
  mode: RetrievalMode,
  queryTerms: string[]
): TriageKnowledgeContext => ({
  snippets: hits.slice(0, MAX_FINAL_SNIPPETS).map(hit => ({
    title: `${hit.documentTitle} / ${hit.title}`,
    content: hit.content.slice(0, 500),
    riskCodes: hit.riskCodes,
    specialtyTags: hit.specialtyTags,
  })),
  trace: {
    mode,
    queryTerms,
    chunkIds: hits.map(hit => hit.chunkId),
    documentTitles: Array.from(new Set(hits.map(hit => hit.documentTitle))),
  },
});

export async function runRetrieval(input: {
  latestMessage: string;
  sessionSummary?: string | null;
}): Promise<TriageKnowledgeContext | null> {
  const retrievalQuery = [input.latestMessage.trim(), input.sessionSummary?.trim()]
    .filter(Boolean)
    .join("\n");
  if (!retrievalQuery) {
    return null;
  }

  const keywordResult = await keywordSearch(retrievalQuery);
  if (keywordResult.hits.length >= MAX_FINAL_SNIPPETS) {
    const hydrated = await readChunk(keywordResult.hits.slice(0, MAX_FINAL_SNIPPETS).map(hit => hit.chunkId));
    return toKnowledgeContext(hydrated, "keyword", keywordResult.terms);
  }

  const semanticResult = await semanticSearch(retrievalQuery);
  const combined = dedupeHits([...keywordResult.hits, ...semanticResult.hits]).slice(
    0,
    MAX_FINAL_SNIPPETS
  );
  if (combined.length === 0) {
    return null;
  }

  const hydrated = await readChunk(combined.map(hit => hit.chunkId));
  return toKnowledgeContext(
    hydrated,
    keywordResult.hits.length > 0 ? "hybrid" : "semantic",
    keywordResult.terms
  );
}
