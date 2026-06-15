// ─── Shared domain types ─────────────────────────────────────────────────────

export type SourceType = "pdf" | "markdown" | "url" | "seed" | "text";

/** Fixed topic taxonomy — powers analytics "by topic" breakdowns. */
export const TOPICS = [
  "Billing & Plans",
  "Account & Security",
  "Sharing & Collaboration",
  "Sync & Desktop",
  "Storage & Limits",
  "Mobile",
  "Integrations",
  "Troubleshooting",
  "Out of Scope",
  "Other",
] as const;

export type Topic = (typeof TOPICS)[number];

export type MessageRole = "user" | "assistant" | "agent" | "system";

export type ConversationStatus = "active" | "escalated" | "resolved";

export type EscalationStatus = "open" | "claimed" | "closed";

export type FeedbackRating = "up" | "down";

// ─── Persisted records ───────────────────────────────────────────────────────

export interface DocumentRecord {
  id: string;
  source_type: SourceType;
  source_name: string;
  title: string;
  topic: Topic | null;
  chunk_count: number;
  created_at: string;
}

export interface ChunkRecord {
  id: string;
  document_id: string;
  title: string;
  content: string;
  chunk_index: number;
  /** Present only when loaded for retrieval. */
  embedding?: Float32Array;
}

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  /** Cosine similarity in [-1, 1]. */
  score: number;
}

export interface ConversationRecord {
  id: string;
  status: ConversationStatus;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRecord {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  /** Retrieval confidence for assistant turns (0..1), null otherwise. */
  confidence: number | null;
  escalated: 0 | 1;
  topic: Topic | null;
  /** JSON-encoded RetrievedChunk[] used as grounding for assistant turns. */
  citations: string | null;
  created_at: string;
}

/** A structured citation surfaced to the UI alongside an assistant message. */
export interface Citation {
  chunkId: string;
  documentId: string;
  title: string;
  score: number;
  snippet: string;
}

export interface FeedbackRecord {
  id: string;
  message_id: string;
  conversation_id: string;
  rating: FeedbackRating;
  comment: string | null;
  reviewed: 0 | 1;
  created_at: string;
}

/** Structured handoff a human agent reads instead of the whole thread. */
export interface HandoffSummary {
  customerGoal: string;
  conversationSummary: string;
  attemptedResolution: string;
  keyFacts: string[];
  suggestedNextSteps: string[];
  sentiment: "calm" | "neutral" | "frustrated" | "angry";
  topic: Topic;
}

export interface EscalationRecord {
  id: string;
  conversation_id: string;
  reason: string;
  confidence: number;
  topic: Topic;
  /** JSON-encoded HandoffSummary. */
  summary: string;
  status: EscalationStatus;
  claimed_by: string | null;
  created_at: string;
}

/** One row per user query — the analytics fact table. */
export interface QueryEvent {
  id: string;
  conversation_id: string;
  message_id: string;
  query: string;
  topic: Topic;
  confidence: number;
  resolved: 0 | 1;
  escalated: 0 | 1;
  created_at: string;
}

// ─── Agent pipeline I/O ──────────────────────────────────────────────────────

export interface AgentTurnResult {
  answer: string;
  confidence: number;
  escalated: boolean;
  topic: Topic;
  citations: Citation[];
  reason: string;
  handoff?: HandoffSummary;
}
