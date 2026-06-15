import { z } from "zod";
import {
  getConversation,
  getEscalation,
  listEscalations,
  setConversationStatus,
  updateEscalationStatus,
} from "@/lib/store";
import type { EscalationStatus, HandoffSummary } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSummary(raw: string): HandoffSummary | null {
  try {
    return JSON.parse(raw) as HandoffSummary;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status") as EscalationStatus | null;
  const escalations = listEscalations(status ?? undefined).map((e) => ({
    id: e.id,
    conversationId: e.conversation_id,
    conversationTitle: getConversation(e.conversation_id)?.title ?? null,
    reason: e.reason,
    confidence: e.confidence,
    topic: e.topic,
    status: e.status,
    claimedBy: e.claimed_by,
    createdAt: e.created_at,
    handoff: parseSummary(e.summary),
  }));
  return Response.json({ escalations });
}

const ActionBody = z.object({
  id: z.string(),
  action: z.enum(["claim", "close", "reopen"]),
  by: z.string().optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof ActionBody>;
  try {
    body = ActionBody.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const esc = getEscalation(body.id);
  if (!esc) return Response.json({ error: "Escalation not found" }, { status: 404 });

  if (body.action === "claim") {
    updateEscalationStatus(body.id, "claimed", body.by ?? "Agent");
  } else if (body.action === "close") {
    updateEscalationStatus(body.id, "closed", esc.claimed_by ?? body.by ?? "Agent");
    setConversationStatus(esc.conversation_id, "resolved");
  } else {
    updateEscalationStatus(body.id, "open");
  }

  return Response.json({ ok: true, escalation: getEscalation(body.id) });
}
