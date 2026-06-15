import { z } from "zod";
import { listReviewQueue, markFeedbackReviewed } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const queue = listReviewQueue().map((item) => ({
    feedbackId: item.feedback.id,
    messageId: item.feedback.message_id,
    conversationId: item.feedback.conversation_id,
    comment: item.feedback.comment,
    createdAt: item.feedback.created_at,
    query: item.query,
    answer: item.answer,
    topic: item.topic,
  }));
  return Response.json({ queue });
}

const Body = z.object({ feedbackId: z.string() });

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  markFeedbackReviewed(body.feedbackId);
  return Response.json({ ok: true });
}
