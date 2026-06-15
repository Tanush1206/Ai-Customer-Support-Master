import { randomUUID } from "node:crypto";
import { db, vectorToBlob, blobToVector } from "./db";
import type { Chunk } from "./chunk";
import type {
  ConversationRecord,
  ConversationStatus,
  DocumentRecord,
  EscalationRecord,
  EscalationStatus,
  FeedbackRating,
  FeedbackRecord,
  HandoffSummary,
  MessageRecord,
  MessageRole,
  QueryEvent,
  SourceType,
  Topic,
} from "./types";

// ─── Documents & chunks ──────────────────────────────────────────────────────

interface LoadedChunk {
  id: string;
  document_id: string;
  title: string;
  content: string;
  embedding: Float32Array;
}

// Process-local cache of chunk embeddings for brute-force cosine search.
// TTL-bounded so writes from another process (e.g. the seed CLI) are picked up
// within a few seconds; invalidated immediately on in-process writes.
const CACHE_TTL_MS = 3000;
let cache: { chunks: LoadedChunk[]; loadedAt: number; count: number } | null = null;

function invalidateCache() {
  cache = null;
}

function currentChunkCount(): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM chunks").get() as { n: number };
  return row.n;
}

export function loadChunks(): LoadedChunk[] {
  const now = Date.now();
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) return cache.chunks;
  // Cache aged out — only do the heavy blob read if the row count changed.
  const count = currentChunkCount();
  if (cache && cache.count === count) {
    cache.loadedAt = now;
    return cache.chunks;
  }
  const rows = db
    .prepare("SELECT id, document_id, title, content, embedding FROM chunks")
    .all() as { id: string; document_id: string; title: string; content: string; embedding: Uint8Array }[];
  const chunks = rows.map((r) => ({
    id: r.id,
    document_id: r.document_id,
    title: r.title,
    content: r.content,
    embedding: blobToVector(r.embedding),
  }));
  cache = { chunks, loadedAt: now, count };
  return chunks;
}

export interface InsertDocumentInput {
  sourceType: SourceType;
  sourceName: string;
  title: string;
  topic: Topic | null;
  chunks: Chunk[];
  embeddings: number[][];
}

export function insertDocument(input: InsertDocumentInput): DocumentRecord {
  const id = randomUUID();
  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO documents (id, source_type, source_name, title, topic, chunk_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, input.sourceType, input.sourceName, input.title, input.topic, input.chunks.length);

    const stmt = db.prepare(
      `INSERT INTO chunks (id, document_id, title, content, chunk_index, embedding)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    input.chunks.forEach((chunk, i) => {
      stmt.run(
        randomUUID(),
        id,
        chunk.heading || input.title,
        chunk.content,
        i,
        vectorToBlob(input.embeddings[i]),
      );
    });
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  invalidateCache();
  return getDocument(id)!;
}

export function getDocument(id: string): DocumentRecord | undefined {
  return db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocumentRecord | undefined;
}

export function listDocuments(): DocumentRecord[] {
  return db
    .prepare("SELECT * FROM documents ORDER BY created_at DESC")
    .all() as unknown as DocumentRecord[];
}

export function deleteDocument(id: string): void {
  db.prepare("DELETE FROM documents WHERE id = ?").run(id);
  invalidateCache();
}

export function countChunks(): number {
  return currentChunkCount();
}

// ─── Conversations ───────────────────────────────────────────────────────────

export function createConversation(id?: string): ConversationRecord {
  const cid = id ?? randomUUID();
  db.prepare("INSERT OR IGNORE INTO conversations (id) VALUES (?)").run(cid);
  return getConversation(cid)!;
}

export function getConversation(id: string): ConversationRecord | undefined {
  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as
    | ConversationRecord
    | undefined;
}

export function listConversations(): ConversationRecord[] {
  return db
    .prepare("SELECT * FROM conversations ORDER BY updated_at DESC")
    .all() as unknown as ConversationRecord[];
}

export function setConversationStatus(id: string, status: ConversationStatus): void {
  db.prepare("UPDATE conversations SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
    status,
    id,
  );
}

export function setConversationTitle(id: string, title: string): void {
  db.prepare(
    "UPDATE conversations SET title = ? WHERE id = ? AND (title IS NULL OR title = '')",
  ).run(title, id);
}

export function touchConversation(id: string): void {
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(id);
}

// ─── Messages ────────────────────────────────────────────────────────────────

export interface InsertMessageInput {
  conversationId: string;
  role: MessageRole;
  content: string;
  confidence?: number | null;
  escalated?: boolean;
  topic?: Topic | null;
  citations?: string | null;
}

export function insertMessage(input: InsertMessageInput): MessageRecord {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, confidence, escalated, topic, citations)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.conversationId,
    input.role,
    input.content,
    input.confidence ?? null,
    input.escalated ? 1 : 0,
    input.topic ?? null,
    input.citations ?? null,
  );
  touchConversation(input.conversationId);
  return getMessage(id)!;
}

export function getMessage(id: string): MessageRecord | undefined {
  return db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as MessageRecord | undefined;
}

export function getMessages(conversationId: string): MessageRecord[] {
  return db
    .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC")
    .all(conversationId) as unknown as MessageRecord[];
}

// ─── Feedback ────────────────────────────────────────────────────────────────

export function insertFeedback(input: {
  messageId: string;
  conversationId: string;
  rating: FeedbackRating;
  comment?: string | null;
}): FeedbackRecord {
  const id = randomUUID();
  // One feedback per message — replace on re-vote.
  db.prepare("DELETE FROM feedback WHERE message_id = ?").run(input.messageId);
  db.prepare(
    `INSERT INTO feedback (id, message_id, conversation_id, rating, comment)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, input.messageId, input.conversationId, input.rating, input.comment ?? null);
  return db.prepare("SELECT * FROM feedback WHERE id = ?").get(id) as unknown as FeedbackRecord;
}

export function getFeedbackForMessage(messageId: string): FeedbackRecord | undefined {
  return db.prepare("SELECT * FROM feedback WHERE message_id = ?").get(messageId) as
    | FeedbackRecord
    | undefined;
}

/** Negative feedback awaiting KB review, joined with the offending Q/A. */
export function listReviewQueue(): {
  feedback: FeedbackRecord;
  query: string;
  answer: string;
  topic: Topic | null;
}[] {
  const rows = db
    .prepare(
      `SELECT f.*, m.content AS answer, m.topic AS topic
       FROM feedback f JOIN messages m ON m.id = f.message_id
       WHERE f.rating = 'down' AND f.reviewed = 0
       ORDER BY f.created_at DESC`,
    )
    .all() as unknown as (FeedbackRecord & { answer: string; topic: Topic | null })[];

  return rows.map((r) => {
    // The user query is the user message immediately preceding this answer.
    const q = db
      .prepare(
        `SELECT content FROM messages
         WHERE conversation_id = ? AND role = 'user'
           AND created_at <= (SELECT created_at FROM messages WHERE id = ?)
         ORDER BY created_at DESC, rowid DESC LIMIT 1`,
      )
      .get(r.conversation_id, r.message_id) as { content: string } | undefined;
    return {
      feedback: { ...r },
      query: q?.content ?? "(unknown)",
      answer: r.answer,
      topic: r.topic,
    };
  });
}

export function markFeedbackReviewed(id: string): void {
  db.prepare("UPDATE feedback SET reviewed = 1 WHERE id = ?").run(id);
}

// ─── Escalations ─────────────────────────────────────────────────────────────

export function insertEscalation(input: {
  conversationId: string;
  reason: string;
  confidence: number;
  topic: Topic;
  summary: HandoffSummary;
}): EscalationRecord {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO escalations (id, conversation_id, reason, confidence, topic, summary)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.conversationId,
    input.reason,
    input.confidence,
    input.topic,
    JSON.stringify(input.summary),
  );
  return getEscalation(id)!;
}

export function getEscalation(id: string): EscalationRecord | undefined {
  return db.prepare("SELECT * FROM escalations WHERE id = ?").get(id) as
    | EscalationRecord
    | undefined;
}

export function listEscalations(status?: EscalationStatus): EscalationRecord[] {
  if (status) {
    return db
      .prepare("SELECT * FROM escalations WHERE status = ? ORDER BY created_at DESC")
      .all(status) as unknown as EscalationRecord[];
  }
  return db
    .prepare("SELECT * FROM escalations ORDER BY created_at DESC")
    .all() as unknown as EscalationRecord[];
}

export function updateEscalationStatus(
  id: string,
  status: EscalationStatus,
  claimedBy?: string,
): void {
  db.prepare("UPDATE escalations SET status = ?, claimed_by = ? WHERE id = ?").run(
    status,
    claimedBy ?? null,
    id,
  );
}

// ─── Query events (analytics fact table) ─────────────────────────────────────

export function insertQueryEvent(input: {
  conversationId: string;
  messageId: string;
  query: string;
  topic: Topic;
  confidence: number;
  resolved: boolean;
  escalated: boolean;
}): void {
  db.prepare(
    `INSERT INTO query_events
       (id, conversation_id, message_id, query, topic, confidence, resolved, escalated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    input.conversationId,
    input.messageId,
    input.query,
    input.topic,
    input.confidence,
    input.resolved ? 1 : 0,
    input.escalated ? 1 : 0,
  );
}

export function listQueryEvents(): QueryEvent[] {
  return db
    .prepare("SELECT * FROM query_events ORDER BY created_at DESC")
    .all() as unknown as QueryEvent[];
}
