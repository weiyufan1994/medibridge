export type RetrievalMode = "keyword" | "semantic" | "hybrid";

export type KnowledgeHit = {
  chunkId: number;
  documentId: number;
  documentTitle: string;
  chunkIndex: number;
  title: string;
  content: string;
  riskCodes: string[];
  specialtyTags: string[];
  score?: number;
};

export type RetrievalTrace = {
  mode: RetrievalMode;
  queryTerms: string[];
  chunkIds: number[];
  documentTitles: string[];
};

export type TriageKnowledgeContext = {
  snippets: Array<{
    title: string;
    content: string;
    riskCodes: string[];
    specialtyTags: string[];
  }>;
  trace: RetrievalTrace;
};
