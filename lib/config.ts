// Central runtime configuration, read once from the environment.

function num(value: string | undefined, fallback: number): number {
  const n = value ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    baseUrl: "https://openrouter.ai/api/v1",
    model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
    utilityModel:
      process.env.OPENROUTER_UTILITY_MODEL ??
      process.env.OPENROUTER_MODEL ??
      "openai/gpt-4o-mini",
    siteUrl: process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
    siteName: process.env.OPENROUTER_SITE_NAME ?? "Nimbus Support",
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    embeddingModel: process.env.EMBEDDING_MODEL ?? "models/gemini-embedding-2",
    embeddingDim: num(process.env.EMBEDDING_DIM, 768),
  },
  rag: {
    /** Escalate below this top cosine similarity. */
    confidenceThreshold: num(process.env.CONFIDENCE_THRESHOLD, 0.3),
    topK: num(process.env.RAG_TOP_K, 6),
  },
} as const;

export function assertLLMKeys(): void {
  const missing: string[] = [];
  if (!config.openrouter.apiKey) missing.push("OPENROUTER_API_KEY");
  if (!config.gemini.apiKey) missing.push("GEMINI_API_KEY");
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Copy .env.example to .env and fill them in.`,
    );
  }
}
