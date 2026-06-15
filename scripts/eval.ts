// Runs the demo test set (scripts/demo-queries.json) against the live agent and
// scores it against the success metrics:
//   • ≥70% of in-scope queries resolved without escalation
//   • 100% of out-of-scope queries correctly escalated
//   • multi-turn follow-ups answered using earlier context
//
//   1. Start the app + seed it (npm run dev; npm run seed)
//   2. npm run eval     (override target with BASE_URL=...)

import { readFileSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 4);

interface InScope {
  query: string;
  topic: string;
  expectAnswerContains?: string[];
}
interface OutOfScope {
  query: string;
  reason: string;
}
interface FollowUp {
  turns: string[];
  note: string;
  expectEscalation?: boolean;
}
interface EvalSet {
  inScope: InScope[];
  outOfScope: OutOfScope[];
  followUps: FollowUp[];
}

interface ChatResult {
  conversationId: string | null;
  escalated: boolean;
  confidence: number;
  topic: string;
  answer: string;
  error: string | null;
}

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

async function runChat(message: string, conversationId?: string): Promise<ChatResult> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversationId }),
  });
  if (!res.ok || !res.body) {
    return {
      conversationId: conversationId ?? null,
      escalated: false,
      confidence: 0,
      topic: "",
      answer: "",
      error: `HTTP ${res.status}`,
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const out: ChatResult = {
    conversationId: conversationId ?? null,
    escalated: false,
    confidence: 0,
    topic: "",
    answer: "",
    error: null,
  };

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
        out.conversationId = evt.conversationId ?? out.conversationId;
        out.escalated = evt.escalated;
        out.confidence = evt.confidence;
        out.topic = evt.topic;
      } else if (evt.type === "token") {
        out.answer += evt.value;
      } else if (evt.type === "done") {
        out.escalated = evt.escalated;
        out.confidence = evt.confidence;
        out.topic = evt.topic;
      } else if (evt.type === "error") {
        out.error = evt.message;
      }
    }
  }
  return out;
}

async function mapPool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return results;
}

async function serverReady(): Promise<{ ok: boolean; chunks: number }> {
  try {
    const res = await fetch(`${BASE_URL}/api/admin/analytics`);
    const data = (await res.json()) as { totals: { chunks: number } };
    return { ok: true, chunks: data.totals.chunks };
  } catch {
    return { ok: false, chunks: 0 };
  }
}

async function main() {
  console.log(`\n  ${bold("Nimbus agent evaluation")} → ${BASE_URL}\n`);

  const ready = await serverReady();
  if (!ready.ok) {
    console.error(`  ✗ Cannot reach ${BASE_URL}. Start the server first.\n`);
    process.exit(1);
  }
  if (ready.chunks === 0) {
    console.error(`  ✗ Knowledge base is empty. Run "npm run seed" first.\n`);
    process.exit(1);
  }
  console.log(dim(`  Knowledge base: ${ready.chunks} chunks indexed.\n`));

  const evalSet = JSON.parse(
    readFileSync(join(process.cwd(), "scripts", "demo-queries.json"), "utf8"),
  ) as EvalSet;

  // ── In-scope: should resolve ────────────────────────────────────────────
  console.log(bold("  In-scope queries (expect: resolved)"));
  const inResults = await mapPool(evalSet.inScope, CONCURRENCY, async (q) => {
    const r = await runChat(q.query);
    const grounded = (q.expectAnswerContains ?? []).some((s) =>
      r.answer.toLowerCase().includes(s.toLowerCase()),
    );
    const resolved = !r.escalated && !r.error;
    console.log(
      `    ${resolved ? green("✓ resolved ") : red("✗ escalated")} ${dim(`c=${r.confidence.toFixed(2)}`)}  ${q.query.slice(0, 64)}`,
    );
    return { resolved, grounded, hasExpect: (q.expectAnswerContains ?? []).length > 0 };
  });
  const resolved = inResults.filter((r) => r.resolved).length;
  const resolutionRate = resolved / inResults.length;
  const groundedHits = inResults.filter((r) => r.hasExpect && r.grounded).length;
  const groundedTotal = inResults.filter((r) => r.hasExpect).length;

  // ── Out-of-scope: should escalate ───────────────────────────────────────
  console.log(`\n  ${bold("Out-of-scope queries (expect: escalated)")}`);
  const oosResults = await mapPool(evalSet.outOfScope, CONCURRENCY, async (q) => {
    const r = await runChat(q.query);
    const correct = r.escalated && !r.error;
    console.log(
      `    ${correct ? green("✓ escalated") : red("✗ answered ")} ${dim(`c=${r.confidence.toFixed(2)}`)}  ${q.query.slice(0, 64)}`,
    );
    return correct;
  });
  const oosCorrect = oosResults.filter(Boolean).length;
  const oosRate = oosCorrect / oosResults.length;

  // ── Multi-turn follow-ups: memory ───────────────────────────────────────
  console.log(`\n  ${bold("Multi-turn follow-ups (expect: context carried across turns)")}`);
  let followPass = 0;
  for (const scenario of evalSet.followUps) {
    let convId: string | undefined;
    let last: ChatResult | null = null;
    for (const turn of scenario.turns) {
      last = await runChat(turn, convId);
      convId = last.conversationId ?? convId;
    }
    const finalOk = scenario.expectEscalation ? last!.escalated : !last!.escalated && !last!.error;
    if (finalOk) followPass++;
    console.log(
      `    ${finalOk ? green("✓") : red("✗")} ${dim(`(${scenario.turns.length} turns)`)} ${scenario.turns.join(dim(" → "))}`,
    );
  }

  // ── Scorecard ───────────────────────────────────────────────────────────
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const pass = (ok: boolean) => (ok ? green("PASS") : red("FAIL"));
  const resOk = resolutionRate >= 0.7;
  const oosOk = oosRate >= 1.0;
  const followOk = followPass === evalSet.followUps.length;

  console.log(`\n  ${bold("──────── Scorecard ────────")}`);
  console.log(
    `  Resolution rate (in-scope) : ${bold(pct(resolutionRate))}  (${resolved}/${inResults.length})   target ≥70%   ${pass(resOk)}`,
  );
  console.log(
    `  Out-of-scope escalation    : ${bold(pct(oosRate))}  (${oosCorrect}/${oosResults.length})   target 100%   ${pass(oosOk)}`,
  );
  console.log(
    `  Multi-turn follow-ups      : ${bold(`${followPass}/${evalSet.followUps.length}`)}                       ${pass(followOk)}`,
  );
  if (groundedTotal > 0) {
    console.log(
      dim(`  Answer-grounding spot check: ${groundedHits}/${groundedTotal} contained an expected fact`),
    );
  }
  console.log("");

  process.exit(resOk && oosOk && followOk ? 0 : 1);
}

await main();
