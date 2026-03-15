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

export const cosineSimilarity = (left: number[], right: number[]) => {
  if (!isFiniteEmbedding(left) || !isFiniteEmbedding(right)) {
    return 0;
  }

  let dotProduct = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < DOCTOR_EMBEDDING_DIMENSIONS; index++) {
    const leftValue = left[index];
    const rightValue = right[index];
    dotProduct += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};
