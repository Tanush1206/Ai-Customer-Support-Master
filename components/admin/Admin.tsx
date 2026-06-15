"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TOPICS, type HandoffSummary } from "@/lib/types";

/* ── API response shapes ──────────────────────────────────────────────────── */
interface Analytics {
  totals: {
    totalQueries: number;
    resolved: number;
    escalated: number;
    resolutionRate: number;
    escalationRate: number;
    avgConfidence: number;
    conversations: number;
    documents: number;
    chunks: number;
  };
  volumeByDay: { date: string; total: number; escalated: number }[];
  topicBreakdown: { topic: string; total: number; resolved: number; escalated: number; avgConfidence: number }[];
  escalationByTopic: { topic: string; count: number }[];
  topUnanswered: { query: string; count: number; avgConfidence: number; topic: string; lastAsked: string }[];
  feedback: { up: number; down: number; reviewQueue: number };
  openEscalations: number;
}
interface Escalation {
  id: string;
  conversationId: string;
  conversationTitle: string | null;
  reason: string;
  confidence: number;
  topic: string;
  status: "open" | "claimed" | "closed";
  claimedBy: string | null;
  createdAt: string;
  handoff: HandoffSummary | null;
}
interface ReviewItem {
  feedbackId: string;
  query: string;
  answer: string;
  topic: string | null;
  comment: string | null;
  createdAt: string;
}
interface DocRec {
  id: string;
  source_type: string;
  source_name: string;
  title: string;
  topic: string | null;
  chunk_count: number;
  created_at: string;
}

const pct = (n: number) => `${(n * 100).toFixed(n >= 0.995 ? 0 : 1)}%`;

export default function Admin() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [docs, setDocs] = useState<DocRec[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const [a, e, r, d] = await Promise.all([
      fetch("/api/admin/analytics").then((x) => x.json()),
      fetch("/api/escalations").then((x) => x.json()),
      fetch("/api/admin/review").then((x) => x.json()),
      fetch("/api/ingest").then((x) => x.json()),
    ]).catch(() => [null, null, null, null]);
    if (a) setAnalytics(a);
    if (e?.escalations) setEscalations(e.escalations);
    if (r?.queue) setReview(r.queue);
    if (d?.documents) setDocs(d.documents);
    setUpdatedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 7000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  const t = analytics?.totals;
  const noData = !!analytics && t!.totalQueries === 0;

  return (
    <main className="mx-auto max-w-6xl px-6 pb-24">
      {/* Masthead */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-line-strong py-7">
        <div>
          <p className="eyebrow mb-2">Analytics · Live ledger</p>
          <h1 className="font-display text-5xl font-semibold leading-none tracking-tight">The Desk</h1>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
            Auto-refresh · 7s
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
            Updated {updatedAt || "…"}
          </p>
        </div>
      </div>

      {!analytics ? (
        <p className="py-16 text-center font-mono text-xs uppercase tracking-[0.2em] text-ink-soft">
          Loading ledger…
        </p>
      ) : (
        <>
          {/* KPI row */}
          <section className="grid grid-cols-2 gap-px border-b border-line bg-line md:grid-cols-4">
            <Stat label="Queries handled" value={String(t!.totalQueries)} sub={`${t!.conversations} sessions`} />
            <Stat
              label="Resolution rate"
              value={pct(t!.resolutionRate)}
              sub={`${t!.resolved} resolved by AI`}
              accent="confident"
            />
            <Stat
              label="Escalations"
              value={String(t!.escalated)}
              sub={`${analytics.openEscalations} open · ${pct(t!.escalationRate)}`}
              accent="accent"
            />
            <Stat
              label="Avg confidence"
              value={pct(t!.avgConfidence)}
              sub={`${t!.documents} docs · ${t!.chunks} chunks`}
            />
          </section>

          {noData && (
            <p className="mt-6 rounded-lg border border-line bg-paper-2/60 p-4 text-sm text-ink-soft">
              No queries recorded yet. Seed the knowledge base (<code className="font-mono text-xs">npm run seed</code>)
              and chat on the{" "}
              <a href="/" className="text-accent-deep underline underline-offset-2">
                support page
              </a>{" "}
              — this ledger fills in real time.
            </p>
          )}

          {/* Resolution + Topic spread */}
          <section className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <SectionHead n="01" title="Where the volume goes" />
              <ResolutionBar resolved={t!.resolved} escalated={t!.escalated} />
              <TopicChart topics={analytics.topicBreakdown} />
            </div>
            <div>
              <SectionHead n="02" title="Most-asked, unanswered" />
              <UnansweredList items={analytics.topUnanswered} />
              <FeedbackStrip feedback={analytics.feedback} />
            </div>
          </section>

          {/* Escalation queue */}
          <section className="mt-12">
            <SectionHead n="03" title="The escalation queue" count={escalations.filter((e) => e.status !== "closed").length} />
            <EscalationQueue escalations={escalations} onAction={load} />
          </section>

          {/* KB review + knowledge base */}
          <section className="mt-12 grid gap-10 lg:grid-cols-2">
            <div>
              <SectionHead n="04" title="Flagged for KB review" count={review.length} />
              <ReviewQueue items={review} onAction={load} />
            </div>
            <div>
              <SectionHead n="05" title="Knowledge base" count={docs.length} />
              <KnowledgeBase docs={docs} onChanged={load} />
            </div>
          </section>
        </>
      )}
    </main>
  );
}

/* ── Primitives ───────────────────────────────────────────────────────────── */
function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "accent" | "confident";
}) {
  const color = accent === "accent" ? "text-accent" : accent === "confident" ? "text-confident" : "text-ink";
  return (
    <div className="bg-paper px-5 py-6">
      <p className="eyebrow mb-3">{label}</p>
      <p className={`font-display text-4xl font-semibold leading-none tracking-tight ${color}`}>{value}</p>
      {sub && <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">{sub}</p>}
    </div>
  );
}

function SectionHead({ n, title, count }: { n: string; title: string; count?: number }) {
  return (
    <div className="mb-4 flex items-baseline justify-between border-b border-line pb-2">
      <h2 className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] text-accent">{n}</span>
        <span className="font-display text-2xl font-semibold tracking-tight">{title}</span>
      </h2>
      {typeof count === "number" && (
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">{count} items</span>
      )}
    </div>
  );
}

function ResolutionBar({ resolved, escalated }: { resolved: number; escalated: number }) {
  const total = resolved + escalated || 1;
  const rPct = (resolved / total) * 100;
  return (
    <div className="mb-8">
      <div className="flex h-9 overflow-hidden rounded-lg border border-line">
        <div className="flex items-center justify-start bg-confident/80 pl-3" style={{ width: `${rPct}%` }}>
          {rPct > 14 && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper">
              {Math.round(rPct)}% resolved
            </span>
          )}
        </div>
        <div className="flex flex-1 items-center justify-end bg-accent/85 pr-3">
          {100 - rPct > 12 && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper">
              {Math.round(100 - rPct)}% escalated
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
        <span>● {resolved} auto-resolved</span>
        <span>{escalated} to humans ●</span>
      </div>
    </div>
  );
}

function TopicChart({ topics }: { topics: Analytics["topicBreakdown"] }) {
  const max = Math.max(1, ...topics.map((x) => x.total));
  return (
    <div>
      <p className="eyebrow mb-3">Volume by topic · escalations in red</p>
      <div className="space-y-2.5">
        {topics.length === 0 && <p className="text-sm text-ink-soft">No topic data yet.</p>}
        {topics.map((topic) => (
          <div key={topic.topic} className="grid grid-cols-[140px_1fr_38px] items-center gap-3">
            <span className="truncate text-[12px] text-ink-soft" title={topic.topic}>
              {topic.topic}
            </span>
            <div className="relative h-5 overflow-hidden rounded bg-paper-2">
              <div
                className="absolute inset-y-0 left-0 bg-ink/80"
                style={{ width: `${(topic.total / max) * 100}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-accent"
                style={{ width: `${(topic.escalated / max) * 100}%` }}
              />
            </div>
            <span className="text-right font-mono text-[11px] text-ink">{topic.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UnansweredList({ items }: { items: Analytics["topUnanswered"] }) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-soft">Nothing unanswered yet — escalated questions surface here.</p>;
  }
  return (
    <ol className="divide-y divide-line">
      {items.map((it, i) => (
        <li key={it.query + i} className="flex items-start gap-4 py-3">
          <span className="font-display text-xl font-semibold leading-none text-line-strong">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] leading-snug">{it.query}</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
              {it.topic} · confidence {(it.avgConfidence * 100).toFixed(0)}%
            </p>
          </div>
          {it.count > 1 && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent-deep">
              ×{it.count}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function FeedbackStrip({ feedback }: { feedback: Analytics["feedback"] }) {
  return (
    <div className="mt-6 flex items-center gap-6 border-t border-line pt-4">
      <div>
        <p className="eyebrow mb-1">Thumbs up</p>
        <p className="font-display text-2xl font-semibold text-confident">{feedback.up}</p>
      </div>
      <div>
        <p className="eyebrow mb-1">Thumbs down</p>
        <p className="font-display text-2xl font-semibold text-accent">{feedback.down}</p>
      </div>
      <div>
        <p className="eyebrow mb-1">Awaiting review</p>
        <p className="font-display text-2xl font-semibold">{feedback.reviewQueue}</p>
      </div>
    </div>
  );
}

/* ── Escalation queue ─────────────────────────────────────────────────────── */
function EscalationQueue({ escalations, onAction }: { escalations: Escalation[]; onAction: () => void }) {
  const act = async (id: string, action: "claim" | "close") => {
    await fetch("/api/escalations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, by: "You" }),
    });
    onAction();
  };

  if (escalations.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-paper-2/50 p-6 text-center text-sm text-ink-soft">
        No escalations yet. When the AI hands off, the full context arrives here.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {escalations.map((e) => (
        <article
          key={e.id}
          className={`flex flex-col rounded-xl border p-4 ${
            e.status === "closed" ? "border-line bg-paper-2/40 opacity-70" : "border-accent/30 bg-accent/[0.04]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
              {e.topic}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
              {e.status} · {new Date(e.createdAt + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          <h3 className="mt-2 font-display text-lg font-semibold leading-tight">
            {e.handoff?.customerGoal ?? e.conversationTitle ?? "Support request"}
          </h3>

          {e.handoff && (
            <dl className="mt-2 space-y-1.5 text-[12.5px] leading-snug">
              <HRow label="Summary" value={e.handoff.conversationSummary} />
              {e.handoff.keyFacts?.length > 0 && (
                <HRow label="Key facts" value={e.handoff.keyFacts.join(" · ")} />
              )}
              {e.handoff.suggestedNextSteps?.length > 0 && (
                <HRow label="Next steps" value={e.handoff.suggestedNextSteps.join("; ")} />
              )}
              <HRow label="Sentiment" value={e.handoff.sentiment} />
            </dl>
          )}

          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-soft">
            Why: {e.reason}
          </p>

          <div className="mt-auto flex gap-2 pt-3">
            {e.status === "open" && (
              <button
                onClick={() => act(e.id, "claim")}
                className="rounded-md bg-ink px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-accent"
              >
                Claim
              </button>
            )}
            {e.status !== "closed" && (
              <button
                onClick={() => act(e.id, "close")}
                className="rounded-md border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft hover:border-confident hover:text-confident"
              >
                Resolve
              </button>
            )}
            {e.claimedBy && e.status !== "open" && (
              <span className="self-center font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
                {e.claimedBy}
              </span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function HRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-2">
      <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-soft">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

/* ── KB review queue ──────────────────────────────────────────────────────── */
function ReviewQueue({ items, onAction }: { items: ReviewItem[]; onAction: () => void }) {
  const resolve = async (feedbackId: string) => {
    await fetch("/api/admin/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedbackId }),
    });
    onAction();
  };
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-paper-2/50 p-6 text-center text-sm text-ink-soft">
        No thumbs-down yet. Negative feedback lands here for KB improvement.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.feedbackId} className="rounded-lg border border-accent/25 bg-paper-2/40 p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-accent-deep">
            {it.topic ?? "Unknown"} · flagged
          </p>
          <p className="mt-1 text-[13.5px] font-medium">{it.query}</p>
          <p className="mt-1 line-clamp-2 text-[12.5px] text-ink-soft">{it.answer}</p>
          <button
            onClick={() => resolve(it.feedbackId)}
            className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft underline-offset-4 hover:text-confident hover:underline"
          >
            Mark reviewed
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ── Knowledge base manager ───────────────────────────────────────────────── */
function KnowledgeBase({ docs, onChanged }: { docs: DocRec[]; onChanged: () => void }) {
  const del = async (id: string) => {
    await fetch(`/api/ingest?id=${id}`, { method: "DELETE" });
    onChanged();
  };
  return (
    <div>
      <IngestForm onChanged={onChanged} />
      <ul className="mt-5 divide-y divide-line">
        {docs.length === 0 && <li className="py-3 text-sm text-ink-soft">No documents yet.</li>}
        {docs.map((d) => (
          <li key={d.id} className="flex items-center gap-3 py-2.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-accent">{d.source_type}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px]">{d.title}</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-soft">
                {d.topic ?? "Untagged"} · {d.chunk_count} chunks
              </p>
            </div>
            <button
              onClick={() => del(d.id)}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft hover:text-accent"
              aria-label="Delete document"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IngestForm({ onChanged }: { onChanged: () => void }) {
  const [mode, setMode] = useState<"paste" | "url" | "file">("paste");
  const [topic, setTopic] = useState<string>("Other");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      let res: Response;
      if (mode === "file") {
        if (!file) throw new Error("Choose a file first");
        const fd = new FormData();
        fd.append("file", file);
        fd.append("topic", topic);
        res = await fetch("/api/ingest", { method: "POST", body: fd });
      } else if (mode === "url") {
        res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "url", url, topic }),
        });
      } else {
        res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "markdown", name: title || "pasted-doc", title, content, topic }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ingestion failed");
      setMsg({ ok: true, text: `Indexed ${data.chunkCount} chunks. Live in seconds.` });
      setContent("");
      setUrl("");
      setTitle("");
      setFile(null);
      onChanged();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-paper-2/40 p-4">
      <div className="mb-3 flex gap-1">
        {(["paste", "url", "file"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
              mode === m ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-3"
            }`}
          >
            {m === "paste" ? "Markdown" : m}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {mode === "paste" && (
          <>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent/60"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="# Heading&#10;Paste markdown content…"
              className="w-full resize-none rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent/60"
            />
          </>
        )}
        {mode === "url" && (
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.example.com/article"
            className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent/60"
          />
        )}
        {mode === "file" && (
          <input
            type="file"
            accept=".pdf,.md,.markdown,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-1.5 file:font-mono file:text-[10px] file:uppercase file:tracking-[0.14em] file:text-paper"
          />
        )}

        <div className="flex items-center gap-2">
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="flex-1 rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent/60"
          >
            {TOPICS.filter((x) => x !== "Out of Scope").map((tp) => (
              <option key={tp} value={tp}>
                {tp}
              </option>
            ))}
          </select>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-md bg-accent px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-paper hover:bg-accent-deep disabled:opacity-50"
          >
            {busy ? "Indexing…" : "Ingest"}
          </button>
        </div>
        {msg && (
          <p className={`font-mono text-[10px] uppercase tracking-[0.12em] ${msg.ok ? "text-confident" : "text-accent"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}
