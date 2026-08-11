import { ENV } from "./env";

export const resolveChatCompletionsApiUrl = () =>
  ENV.llmApiUrl && ENV.llmApiUrl.trim().length > 0
    ? `${ENV.llmApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

export const resolveEmbeddingsApiUrl = () =>
  ENV.llmApiUrl && ENV.llmApiUrl.trim().length > 0
    ? `${ENV.llmApiUrl.replace(/\/$/, "")}/v1/embeddings`
    : "https://forge.manus.im/v1/embeddings";

export const assertLlmApiKey = () => {
  if (!ENV.llmApiKey) {
    throw new Error(
      "LLM API key is not configured. Set LLM_API_KEY or OPENAI_API_KEY"
    );
  }
};

export const withTimeoutSignal = (timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
};

export const getErrorText = async (response: Response) => {
  try {
    return await response.text();
  } catch {
    return "";
  }
};
