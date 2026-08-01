export const DOCTOR_EMBEDDING_DIMENSIONS = 1024;

export const isFiniteEmbedding = (value: unknown): value is number[] => {
  return (
    Array.isArray(value) &&
    value.length === DOCTOR_EMBEDDING_DIMENSIONS &&
    value.every(item => typeof item === "number" && Number.isFinite(item))
  );
};

export const normalizeEmbedding = (value: unknown): number[] | null => {
  if (Array.isArray(value)) {
    const vector = value.map(Number);
    return isFiniteEmbedding(vector) ? vector : null;
  }

  if (typeof value === "string") {
    try {
      return normalizeEmbedding(JSON.parse(value));
    } catch {
      return null;
    }
  }

  return null;
};

export const toPgVectorLiteral = (embedding: number[]) => {
  if (!isFiniteEmbedding(embedding)) {
    throw new Error(
      `Expected embedding with exactly ${DOCTOR_EMBEDDING_DIMENSIONS} dimensions`
    );
  }

  return `[${embedding.join(",")}]`;
};
