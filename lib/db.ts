import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// Single connection reused across HMR reloads in dev.
const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = process.env.NIMBUS_DB_PATH ?? join(DATA_DIR, "nimbus.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS documents (
  id           TEXT PRIMARY KEY,
  source_type  TEXT NOT NULL,
  source_name  TEXT NOT NULL,
  title        TEXT NOT NULL,
  topic        TEXT,
  chunk_count  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chunks (
  id           TEXT PRIMARY KEY,
  document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  chunk_index  INTEGER NOT NULL,
  embedding    BLOB NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);

CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,
  status      TEXT NOT NULL DEFAULT 'active',
  title       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL,
  content          TEXT NOT NULL,
  confidence       REAL,
  escalated        INTEGER NOT NULL DEFAULT 0,
  topic            TEXT,
  citations        TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

CREATE TABLE IF NOT EXISTS feedback (
  id               TEXT PRIMARY KEY,
  message_id       TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id  TEXT NOT NULL,
  rating           TEXT NOT NULL,
  comment          TEXT,
  reviewed         INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_message ON feedback(message_id);

CREATE TABLE IF NOT EXISTS escalations (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  reason           TEXT NOT NULL,
  confidence       REAL NOT NULL,
  topic            TEXT NOT NULL,
  summary          TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open',
  claimed_by       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);

CREATE TABLE IF NOT EXISTS query_events (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL,
  message_id       TEXT NOT NULL,
  query            TEXT NOT NULL,
  topic            TEXT NOT NULL,
  confidence       REAL NOT NULL,
  resolved         INTEGER NOT NULL DEFAULT 0,
  escalated        INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_query_events_topic ON query_events(topic);
`;

function create(): DatabaseSync {
  mkdirSync(DATA_DIR, { recursive: true });
  const conn = new DatabaseSync(DB_PATH);
  conn.exec("PRAGMA journal_mode = WAL;");
  conn.exec("PRAGMA busy_timeout = 5000;");
  conn.exec("PRAGMA foreign_keys = ON;");
  conn.exec(SCHEMA);
  return conn;
}

const globalForDb = globalThis as unknown as { __nimbusDb?: DatabaseSync };

function getDb(): DatabaseSync {
  return globalForDb.__nimbusDb ?? (globalForDb.__nimbusDb = create());
}

// Lazy proxy: the connection opens on first *use*, never at import time. This
// keeps `next build` (which imports every route across parallel workers) from
// opening/locking the database, while letting callers use `db.prepare(...)`
// exactly as before at request time.
export const db: DatabaseSync = new Proxy({} as DatabaseSync, {
  get(_target, prop, receiver) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
}) as DatabaseSync;

/** Float32 vector → BLOB for storage. */
export function vectorToBlob(vec: number[] | Float32Array): Uint8Array {
  const f32 = vec instanceof Float32Array ? vec : Float32Array.from(vec);
  return new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
}

/** BLOB → Float32 vector for retrieval. */
export function blobToVector(blob: Uint8Array): Float32Array {
  // Copy into an aligned buffer (sqlite blobs may not be 4-byte aligned).
  const copy = blob.slice();
  return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / 4);
}
