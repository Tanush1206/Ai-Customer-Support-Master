import { config } from "./config";

interface GeminiBatchResponse {
  embeddings: Array<{ values: number[] }>;
}

async function callGemini(inputs: string[]): Promise<number[][]> {
  const modelStr = config.gemini.embeddingModel;
  
  const requests = inputs.map((text) => ({
    model: modelStr,
    content: { parts: [{ text }] },
  }));

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelStr}:batchEmbedContents?key=${config.gemini.apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini embeddings failed (${res.status}): ${detail.slice(0, 500)}`);
  }

  const json = (await res.json()) as GeminiBatchResponse;
  return json.embeddings.map((d) => d.values);
}

/** Embed many texts, batched to stay within request limits. */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!config.gemini.apiKey) throw new Error("GEMINI_API_KEY is not set");
  const BATCH = 96;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH).map((t) => t.replace(/\n+/g, " ").trim() || " ");
    out.push(...(await callGemini(slice)));
  }
  return out;
}

/** Embed a single query. */
export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await embedBatch([text]);
  return vec;
}

/** Cosine similarity between a query vector and a stored Float32 chunk. */
export function cosineSimilarity(a: number[] | Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
