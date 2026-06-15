"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Citation, HandoffSummary } from "@/lib/types";
import { Markdown } from "./Markdown";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  escalated?: boolean;
  confidence?: number | null;
  topic?: string | null;
  citations?: Citation[];
  handoff?: HandoffSummary;
  feedback?: "up" | "down" | null;
  createdAt?: string;
}

const STORAGE_KEY = "nimbus_conversation";

const STARTERS = [
  "How much does the Plus plan cost if I pay annually?",
  "How do I turn on two-factor authentication?",
  "My files won't sync on the desktop app — what should I check?",
  "Can I password-protect a shared link?",
];

function fmtTime(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

let localCounter = 0;
const localId = () => `local-${Date.now()}-${localCounter++}`;

export default function Chat() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "thinking" | "escalating" | "writing">("idle");
  const convRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Restore an in-progress session on load.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    convRef.current = stored;
    setConversationId(stored);
    fetch(`/api/conversations/${stored}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.messages?.length) return;
        setMessages(
          data.messages.map(
            (m: {
              id: string;
              role: ChatMsg["role"];
              content: string;
              escalated: boolean;
              confidence: number | null;
              topic: string | null;
              citations: Citation[];
              feedback: "up" | "down" | null;
              createdAt: string;
            }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              escalated: m.escalated,
              confidence: m.confidence,
              topic: m.topic,
              citations: m.citations,
              feedback: m.feedback,
              createdAt: m.createdAt,
            }),
          ),
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, phase]);

  const withHuman = messages.some((m) => m.role === "assistant" && m.escalated);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || busy) return;
      setBusy(true);
      setInput("");
      setPhase("thinking");

      const userMsg: ChatMsg = {
        id: localId(),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      const assistantId = localId();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: "assistant", content: "", streaming: true, createdAt: new Date().toISOString() },
      ]);

      const patch = (fields: Partial<ChatMsg>) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, ...fields } : m)));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content, conversationId: convRef.current ?? undefined }),
        });

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          patch({ streaming: false, content: `⚠️ ${err.error ?? "Something went wrong."}` });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const line = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const evt = JSON.parse(line.slice(5).trim());

            if (evt.type === "meta") {
              if (evt.conversationId) {
                convRef.current = evt.conversationId;
                setConversationId(evt.conversationId);
                localStorage.setItem(STORAGE_KEY, evt.conversationId);
              }
              patch({
                escalated: evt.escalated,
                confidence: evt.confidence,
                topic: evt.topic,
                citations: evt.citations,
              });
              setPhase(evt.escalated ? "escalating" : "writing");
            } else if (evt.type === "status" && evt.state === "escalating") {
              setPhase("escalating");
            } else if (evt.type === "token") {
              answer += evt.value;
              patch({ content: answer });
              setPhase((p) => (p === "thinking" ? "writing" : p));
            } else if (evt.type === "done") {
              patch({
                id: evt.messageId,
                streaming: false,
                escalated: evt.escalated,
                confidence: evt.confidence,
                topic: evt.topic,
                citations: evt.citations,
                handoff: evt.handoff,
                feedback: null,
              });
            } else if (evt.type === "error") {
              patch({ streaming: false, content: `⚠️ ${evt.message}` });
            }
          }
        }
      } catch (e) {
        patch({ streaming: false, content: `⚠️ ${(e as Error).message}` });
      } finally {
        setBusy(false);
        setPhase("idle");
      }
    },
    [busy],
  );

  const newConversation = () => {
    localStorage.removeItem(STORAGE_KEY);
    convRef.current = null;
    setConversationId(null);
    setMessages([]);
    setPhase("idle");
    taRef.current?.focus();
  };

  const vote = async (m: ChatMsg, rating: "up" | "down") => {
    if (!conversationId || m.id.startsWith("local-")) return;
    const next = m.feedback === rating ? null : rating;
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, feedback: next } : x)));
    if (!next) return;
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: m.id, conversationId, rating: next }),
    }).catch(() => {});
  };

  const empty = messages.length === 0;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-66px)] max-w-3xl flex-col px-5">
      {/* Conversation status bar */}
      <div className="sticky top-0 z-20 -mx-5 flex items-center justify-between border-b border-line bg-paper/85 px-5 py-3 backdrop-blur-sm">
        <StatusPill withHuman={withHuman} active={busy} />
        <div className="flex items-center gap-3">
          {conversationId && (
            <span className="eyebrow hidden sm:inline">
              Session {conversationId.slice(0, 8)}
            </span>
          )}
          {!empty && (
            <button
              onClick={newConversation}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft underline-offset-4 hover:text-accent hover:underline"
            >
              New chat
            </button>
          )}
        </div>
      </div>

      {empty ? (
        <EmptyState onPick={send} disabled={busy} />
      ) : (
        <div className="flex-1 space-y-9 py-8">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <UserMessage key={m.id} msg={m} />
            ) : (
              <AssistantMessage
                key={m.id}
                msg={m}
                isLead={i === 1}
                phase={m.streaming ? phase : "idle"}
                onVote={vote}
              />
            ),
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <Composer
        value={input}
        onChange={setInput}
        onSend={() => send(input)}
        busy={busy}
        withHuman={withHuman}
        taRef={taRef}
      />
    </main>
  );
}

/* ── Status pill ──────────────────────────────────────────────────────────── */
function StatusPill({ withHuman, active }: { withHuman: boolean; active: boolean }) {
  if (withHuman) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-deep">
          Human desk · reviewing
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-2 px-3 py-1">
      <span
        className={`h-2 w-2 rounded-full ${active ? "bg-confident" : "bg-ink-soft"} ${active ? "animate-pulse" : ""}`}
      />
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
        Nimbus AI · {active ? "working" : "ready"}
      </span>
    </span>
  );
}

/* ── Empty / hero state ───────────────────────────────────────────────────── */
function EmptyState({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-1 flex-col justify-center py-12">
      <p className="eyebrow mb-4">The Support Desk · Open 24/7</p>
      <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
        Answers,
        <br />
        <span className="text-accent">delivered.</span>
      </h1>
      <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-soft">
        Ask anything about Nimbus — storage, billing, sharing, sync. Our AI resolves common issues
        instantly and hands the tricky ones to a human with the full story.
      </p>
      <div className="mt-9 border-t border-line pt-5">
        <p className="eyebrow mb-3">Start with a question</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {STARTERS.map((q) => (
            <button
              key={q}
              disabled={disabled}
              onClick={() => onPick(q)}
              className="group flex items-center gap-3 rounded-lg border border-line bg-paper-2/60 px-4 py-3 text-left text-sm leading-snug transition-all hover:border-accent/50 hover:bg-paper-2 disabled:opacity-50"
            >
              <span className="font-display text-accent transition-transform group-hover:translate-x-0.5">
                →
              </span>
              <span>{q}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── User message ─────────────────────────────────────────────────────────── */
function UserMessage({ msg }: { msg: ChatMsg }) {
  return (
    <div className="rise-in flex flex-col items-end">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
          You · {fmtTime(msg.createdAt)}
        </span>
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm border border-line bg-paper-2 px-4 py-2.5 text-[15px] leading-relaxed">
        {msg.content}
      </div>
    </div>
  );
}

/* ── Assistant message ────────────────────────────────────────────────────── */
function AssistantMessage({
  msg,
  isLead,
  phase,
  onVote,
}: {
  msg: ChatMsg;
  isLead: boolean;
  phase: "idle" | "thinking" | "escalating" | "writing";
  onVote: (m: ChatMsg, r: "up" | "down") => void;
}) {
  const showThinking = msg.streaming && (phase === "thinking" || phase === "escalating") && !msg.content;

  return (
    <div className="rise-in">
      {/* Byline */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink">Nimbus</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
          {msg.escalated ? "Specialist relay" : "AI agent"} · {fmtTime(msg.createdAt)}
        </span>
        {msg.topic && !msg.escalated && (
          <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
            {msg.topic}
          </span>
        )}
        {typeof msg.confidence === "number" && !msg.streaming && (
          <ConfidenceMeter value={msg.confidence} escalated={!!msg.escalated} />
        )}
      </div>

      {showThinking ? (
        <ThinkingRow escalating={phase === "escalating"} />
      ) : (
        <>
          {msg.escalated && <EscalationBanner handoff={msg.handoff} streaming={msg.streaming} />}
          <Markdown dropcap={isLead && !msg.escalated && msg.content.length > 120}>
            {msg.content || "…"}
          </Markdown>
          {msg.streaming && msg.content && <Caret />}
        </>
      )}

      {!msg.streaming && msg.citations && msg.citations.length > 0 && (
        <Citations citations={msg.citations} />
      )}

      {!msg.streaming && !msg.id.startsWith("local-") && (
        <Feedback msg={msg} onVote={onVote} />
      )}
    </div>
  );
}

function ConfidenceMeter({ value, escalated }: { value: number; escalated: boolean }) {
  const segments = 5;
  const filled = Math.max(escalated ? 1 : 1, Math.round(value * segments));
  const color = escalated ? "bg-accent" : value >= 0.5 ? "bg-confident" : "bg-ink";
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`Retrieval confidence ${(value * 100).toFixed(0)}%`}
    >
      <span className="flex gap-0.5">
        {Array.from({ length: segments }).map((_, i) => (
          <span
            key={i}
            className={`h-2 w-1 rounded-full ${i < filled ? color : "bg-line"}`}
          />
        ))}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-soft">
        {escalated ? "low" : value >= 0.5 ? "high" : "fair"}
      </span>
    </span>
  );
}

function EscalationBanner({
  handoff,
  streaming,
}: {
  handoff?: HandoffSummary;
  streaming?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3 rounded-xl border border-accent/40 bg-accent/[0.06] p-4">
      <div className="flex items-center gap-2">
        <span className="font-display text-lg leading-none text-accent">✦</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-deep">
          Handed to the desk
        </span>
      </div>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
        This one needs a human. I&apos;ve packaged the full context so the agent can pick up without
        asking you to repeat anything.
      </p>
      {handoff && (
        <div className="mt-3">
          <button
            onClick={() => setOpen((o) => !o)}
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent-deep underline-offset-4 hover:underline"
          >
            {open ? "Hide" : "View"} handoff summary
          </button>
          {open && (
            <dl className="mt-3 grid gap-2 border-t border-accent/20 pt-3 text-[13px]">
              <Row label="Goal" value={handoff.customerGoal} />
              <Row label="Summary" value={handoff.conversationSummary} />
              <Row label="Sentiment" value={handoff.sentiment} />
              {handoff.suggestedNextSteps?.length > 0 && (
                <Row label="Next steps" value={handoff.suggestedNextSteps.join("; ")} />
              )}
            </dl>
          )}
        </div>
      )}
      {streaming && !handoff && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-accent-deep">
          Summarizing for the agent…
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2">
      <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function Citations({ citations }: { citations: Citation[] }) {
  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="eyebrow mb-2">Sources</p>
      <ul className="flex flex-wrap gap-2">
        {citations.map((c, i) => (
          <li
            key={c.chunkId}
            title={c.snippet}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-2/60 px-2.5 py-1 text-[11px] text-ink-soft"
          >
            <span className="font-mono text-[9px] text-accent">{i + 1}</span>
            <span className="max-w-[180px] truncate">{c.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Feedback({ msg, onVote }: { msg: ChatMsg; onVote: (m: ChatMsg, r: "up" | "down") => void }) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">Helpful?</span>
      <button
        onClick={() => onVote(msg, "up")}
        aria-label="Helpful"
        className={`rounded-md border px-1.5 py-0.5 text-xs transition-colors ${
          msg.feedback === "up"
            ? "border-confident bg-confident/15 text-confident"
            : "border-line text-ink-soft hover:border-confident hover:text-confident"
        }`}
      >
        ↑
      </button>
      <button
        onClick={() => onVote(msg, "down")}
        aria-label="Not helpful"
        className={`rounded-md border px-1.5 py-0.5 text-xs transition-colors ${
          msg.feedback === "down"
            ? "border-accent bg-accent/15 text-accent"
            : "border-line text-ink-soft hover:border-accent hover:text-accent"
        }`}
      >
        ↓
      </button>
      {msg.feedback === "down" && (
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-accent-deep">
          Queued for review
        </span>
      )}
    </div>
  );
}

function ThinkingRow({ escalating }: { escalating: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="typing-dot h-1.5 w-1.5 rounded-full bg-accent"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
        {escalating ? "Reviewing & summarizing for the desk" : "Searching the knowledge base"}
      </span>
    </div>
  );
}

function Caret() {
  return <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-accent" />;
}

/* ── Composer ─────────────────────────────────────────────────────────────── */
function Composer({
  value,
  onChange,
  onSend,
  busy,
  withHuman,
  taRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  busy: boolean;
  withHuman: boolean;
  taRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div className="sticky bottom-0 -mx-5 border-t border-line-strong bg-paper/90 px-5 py-4 backdrop-blur-sm">
      <div className="flex items-end gap-3">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={1}
          placeholder={withHuman ? "Add anything for the agent…" : "Ask the Nimbus desk…"}
          className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-paper-2/50 px-4 py-3 text-[15px] leading-relaxed outline-none transition-colors placeholder:text-ink-soft/70 focus:border-accent/60 focus:bg-paper-2"
        />
        <button
          onClick={onSend}
          disabled={busy || !value.trim()}
          className="group flex h-[44px] items-center gap-2 rounded-xl bg-ink px-5 font-mono text-[11px] uppercase tracking-[0.18em] text-paper transition-all hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "…" : "Send"}
        </button>
      </div>
      <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft/70">
        Enter to send · Shift+Enter for a new line
      </p>
    </div>
  );
}
