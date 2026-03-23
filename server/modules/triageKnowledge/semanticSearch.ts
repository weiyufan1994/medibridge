import { createEmbedding } from "../../_core/llm";
import { semanticSearch as semanticSearchRepo } from "./repo";

export async function semanticSearch(query: string) {
  const embedding = await createEmbedding(query);
  const hits = await semanticSearchRepo(embedding);
  return {
    hits,
    embeddingDimensions: embedding.length,
  };
}
