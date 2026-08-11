import { ENV } from "./env";
import {
  assertLlmApiKey,
  getErrorText,
  resolveEmbeddingsApiUrl,
  withTimeoutSignal,
} from "./llmTransport";

type EmbeddingResult = {
  data?: Array<{ embedding?: number[] }>;
};

export async function createEmbedding(input: string): Promise<number[]> {
  assertLlmApiKey();

  const cleanedInput = input.trim();
  if (!cleanedInput) {
    throw new Error("Embedding input cannot be empty");
  }

  const request = withTimeoutSignal(ENV.llmTimeoutMs);
  let response: Response;

  try {
    response = await fetch(resolveEmbeddingsApiUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ENV.llmApiKey}`,
      },
      body: JSON.stringify({
        model: ENV.llmEmbeddingModel,
        input: cleanedInput,
      }),
      signal: request.signal,
    });
  } catch (error) {
    request.clear();
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Embedding create timed out after ${ENV.llmTimeoutMs}ms for model ${ENV.llmEmbeddingModel}`
      );
    }
    throw error;
  }
  request.clear();

  if (!response.ok) {
    const errorText = await getErrorText(response);
    throw new Error(
      `Embedding create failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  const payload = (await response.json()) as EmbeddingResult;
  const embedding = payload.data?.[0]?.embedding;

  if (!embedding || embedding.length === 0) {
    throw new Error("Embedding response did not contain a valid vector");
  }

  return embedding;
}
