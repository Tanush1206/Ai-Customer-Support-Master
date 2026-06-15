import { cosineSimilarity, embedQuery } from "./embeddings";
import { loadChunks } from "./store";
import { config } from "./config";
import type { RetrievedChunk } from "./types";

export interface RetrievalOutcome {
  chunks: RetrievedChunk[];
  /** Combined retrieval confidence in [0, 1]. */
  confidence: number;
}

/** Embed the query and return the top-k chunks by cosine similarity. */
export async function retrieve(query: string, topK = config.rag.topK): Promise<RetrievalOutcome> {
  const all = loadChunks();
  if (all.length === 0) return { chunks: [], confidence: 0 };

  const qVec = await embedQuery(query);
  const scored = all
    .map((c) => ({
      chunkId: c.id,
      documentId: c.document_id,
      title: c.title,
      content: c.content,
      score: cosineSimilarity(qVec, c.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return { chunks: scored, confidence: confidenceFrom(scored) };
}

/**
 * Confidence blends the single best match (does *something* clearly answer
 * this?) with the mean of the top results (is there broad supporting context?).
 * Clamped to [0, 1]; cosine for an in-scope query typically lands 0.4–0.65.
 */
export function confidenceFrom(chunks: { score: number }[]): number {
  if (chunks.length === 0) return 0;
  const top = chunks[0].score;
  const topN = chunks.slice(0, 3);
  const mean = topN.reduce((s, c) => s + c.score, 0) / topN.length;
  const blended = top * 0.7 + mean * 0.3;
  return Math.max(0, Math.min(1, blended));
}

export function isConfident(confidence: number): boolean {
  return confidence >= config.rag.confidenceThreshold;
}
