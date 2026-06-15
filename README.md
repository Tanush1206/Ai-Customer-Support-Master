# Nimbus Support Desk

A multi-turn **AI customer-support agent** with RAG over a product knowledge base,
confidence-based escalation to a human queue, a live chat UI that *feels like a
magazine*, and an admin analytics panel — all in one Next.js app.

Built for the brief: *triage incoming requests, resolve common issues
autonomously, and escalate edge cases with a complete context summary so the
human agent does not need to re-read the entire thread.*

> Demo product: **Nimbus**, a fictional cloud-storage & collaboration service.
> The seeded knowledge base, FAQs, and resolved tickets are all about Nimbus.

---

## Stack

| Concern | Choice |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 — editorial/magazine theme (Fraunces · Hanken Grotesk · JetBrains Mono) |
| Database | **`node:sqlite`** (built into Node 24+) — single file, zero native deps |
| Answer LLM | **OpenRouter** (`openai/gpt-4o-mini` by default — any model id works) |
| Embeddings | **OpenAI** `text-embedding-3-small` (OpenRouter has no embeddings endpoint) |
| Vector search | Brute-force cosine over stored Float32 embeddings (cached, TTL-bounded) |

---

## Quick start

```bash
# 1. Install (already done if node_modules exists)
npm install

# 2. Add your keys
#    .env is already created — paste two keys into it:
#    OPENROUTER_API_KEY=...   (https://openrouter.ai/keys)
#    OPENAI_API_KEY=...       (https://platform.openai.com/api-keys)

# 3. Run the app
npm run dev               # http://localhost:3000

# 4. In a second terminal, seed the knowledge base (server must be running)
npm run seed              # ingests the 13 Nimbus docs in data/seed/

# 5. (Optional) Score the agent against the demo test set
npm run eval              # resolution rate, escalation accuracy, multi-turn
```

Then open:
- **`/`** — the live support chat
- **`/desk`** — the admin analytics dashboard

> Production build: `npm run build && npm start`.
> Run on another port with `PORT=3939 npm run dev` (and `BASE_URL=http://localhost:3939 npm run seed`).

---

## How it works

### The agent pipeline (`lib/agent.ts`)

```
user turn
   │
   ├─ 1. CONTEXTUALIZE   rewrite the message into a standalone query using
   │                     conversation history, and tag its topic  (utility LLM)
   │
   ├─ 2. RETRIEVE        embed the standalone query (OpenAI) → cosine search
   │                     over the KB → top-k chunks + confidence score
   │
   ├─ 3. GATE            escalate if  topic == "Out of Scope"
   │                              OR  retrieval confidence < threshold
   │
   ├─ 4a. ANSWER         grounded, streamed answer from the retrieved context
   │                     (OpenRouter, SSE) → resolved
   │
   └─ 4b. ESCALATE       empathetic handoff message + a STRUCTURED HANDOFF
                         SUMMARY (goal, summary, key facts, next steps,
                         sentiment) written to the human queue
```

**Confidence** (`lib/rag.ts`) blends the single best cosine match with the mean
of the top results, clamped to `[0,1]`. The escalation threshold is
`CONFIDENCE_THRESHOLD` (default `0.30`). Step 1 makes follow-ups like *"and the
Family plan?"* retrievable by resolving them against earlier turns — that's how
multi-turn memory works.

### Data model (`lib/db.ts`)

`documents`, `chunks` (with `embedding` BLOB), `conversations`, `messages`,
`feedback`, `escalations`, and `query_events` (the analytics fact table — one
row per user query with its topic, confidence, and resolved/escalated flags).

The connection is opened lazily on first use so `next build` (which imports
every route across parallel workers) never opens or locks the database.

---

## Core features → where they live

| Feature | Implementation |
|---|---|
| **RAG knowledge base** (PDF · Markdown · URL) | `lib/ingest.ts` (`unpdf`, `html-to-text`), `lib/chunk.ts`, `lib/embeddings.ts`; `POST /api/ingest` |
| **Multi-turn memory** | `contextualize()` query-rewrite + full history passed to the answer model |
| **Confidence & escalation** | `lib/rag.ts` confidence + `prepareTurn()` gate + `generateHandoff()` structured summary |
| **Live chat UI** | `components/Chat.tsx` — SSE streaming, typing indicators, timestamps, AI-vs-human status, citations |
| **Admin analytics** | `components/admin/Admin.tsx` + `lib/analytics.ts` — volume, resolution rate, top unanswered, escalation-by-topic, queue |
| **Feedback loop** | thumbs up/down → `POST /api/feedback`; down-votes land in the KB review queue (`/desk`) |
| **KB updates ≤ 60s** | ingestion writes embeddings immediately; retrieval reads live (cache TTL 3s) — new docs answer within seconds |

---

## API

| Route | Purpose |
|---|---|
| `POST /api/chat` | Streamed (SSE) agent turn: `meta` → `token…` → `done` events |
| `GET/POST/DELETE /api/ingest` | List / ingest (file or `{kind:"markdown"\|"url"\|"text"}`) / delete a document |
| `POST /api/feedback` | Record thumbs up/down (down → review queue) |
| `GET /api/conversations`, `GET /api/conversations/[id]` | List / resume a conversation |
| `GET/POST /api/escalations` | List the human queue / `claim`·`close` an escalation |
| `GET /api/admin/analytics` | Dashboard metrics |
| `GET/POST /api/admin/review` | KB review queue (negative feedback) / mark reviewed |

---

## Configuration (`.env`)

| Variable | Default | Notes |
|---|---|---|
| `OPENROUTER_API_KEY` | — | **required** — answer LLM |
| `OPENAI_API_KEY` | — | **required** — embeddings |
| `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | any OpenRouter model id |
| `OPENROUTER_UTILITY_MODEL` | = `OPENROUTER_MODEL` | cheaper model for rewrite/topic/handoff |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | OpenAI embedding model |
| `CONFIDENCE_THRESHOLD` | `0.30` | escalate below this top-cosine similarity |
| `RAG_TOP_K` | `6` | chunks retrieved per query |

---

## Meeting the success metrics

- **≥70% resolved without escalation** — the seeded KB covers every in-scope
  topic; `npm run eval` reports the live resolution rate against 32 in-scope queries.
- **All out-of-scope queries escalate** — the topic classifier flags `Out of
  Scope` *and* low retrieval confidence trips the gate; eval includes 12 OOS queries.
- **Admin renders real captured data** — every chat writes a `query_event`; the
  dashboard aggregates them live (auto-refresh 7s).
- **Follow-ups reference earlier turns** — query contextualization + full history;
  eval includes 6 multi-turn scenarios.
- **KB updates reflect ≤ 60s** — ingest → embed → live retrieval; effectively seconds.

## Project layout

```
app/            pages (/ chat, /desk admin) + API routes
components/      Chat.tsx, Markdown.tsx, admin/Admin.tsx
lib/            agent, rag, embeddings, openrouter, ingest, chunk, store, db, analytics, config, types
data/seed/      13 seeded Nimbus documents + manifest.json
scripts/        seed.ts (ingest KB), eval.ts (score the demo test set), demo-queries.json
```
