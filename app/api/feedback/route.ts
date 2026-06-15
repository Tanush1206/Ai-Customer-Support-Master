import { z } from "zod";
import { getMessage, insertFeedback } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  messageId: z.string(),
  conversationId: z.string(),
  rating: z.enum(["up", "down"]),
  comment: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!getMessage(body.messageId)) {
    return Response.json({ error: "Message not found" }, { status: 404 });
  }

  const feedback = insertFeedback({
    messageId: body.messageId,
    conversationId: body.conversationId,
    rating: body.rating,
    comment: body.comment ?? null,
  });

  // A down-vote automatically lands in the KB review queue (reviewed = 0).
  return Response.json({ ok: true, feedback, queuedForReview: body.rating === "down" });
}
