import { getConversation, getFeedbackForMessage, getMessages } from "@/lib/store";
import type { Citation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const conversation = getConversation(id);
  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const messages = getMessages(id).map((m) => {
    let citations: Citation[] = [];
    if (m.citations) {
      try {
        citations = JSON.parse(m.citations) as Citation[];
      } catch {
        citations = [];
      }
    }
    const fb = m.role === "assistant" ? getFeedbackForMessage(m.id) : undefined;
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      confidence: m.confidence,
      escalated: m.escalated === 1,
      topic: m.topic,
      citations,
      feedback: fb?.rating ?? null,
      createdAt: m.created_at,
    };
  });

  return Response.json({ conversation, messages });
}
