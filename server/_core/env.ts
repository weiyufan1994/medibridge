export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  llmModel: process.env.LLM_MODEL ?? "deepseek-ai/DeepSeek-V3",
  llmEmbeddingModel:
    process.env.LLM_EMBEDDING_MODEL ??
    process.env.EMBEDDING_MODEL ??
    "text-embedding-3-small",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  llmApiUrl:
    process.env.LLM_API_URL ??
    process.env.OPENAI_BASE_URL ??
    process.env.BUILT_IN_FORGE_API_URL ??
    process.env.FORGE_API_URL ??
    "",
  llmApiKey:
    process.env.LLM_API_KEY ??
    process.env.OPENAI_API_KEY ??
    process.env.BUILT_IN_FORGE_API_KEY ??
    process.env.FORGE_API_KEY ??
    "",
  forgeApiUrl:
    process.env.BUILT_IN_FORGE_API_URL ??
    process.env.FORGE_API_URL ??
    "",
  forgeApiKey:
    process.env.BUILT_IN_FORGE_API_KEY ??
    process.env.FORGE_API_KEY ??
    "",
};
