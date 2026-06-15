import { z } from "zod";
import { assertLLMKeys } from "@/lib/config";
import { chatStream } from "@/lib/openrouter";
import {
  buildAnswerMessages,
  deriveConversationTitle,
  escalationReply,
  generateHandoff,
  prepareTurn,
  toCitations,
} from "@/lib/agent";
import {
  createConversation,
  getConversation,
  getMessages,
  insertEscalation,
  insertMessage,
  insertQueryEvent,
  setConversationStatus,
  setConversationTitle,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(4000),
});

const encoder = new TextEncoder();
const sse = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

export async function POST(req: Request) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    assertLLMKeys();
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }

  const { message } = parsed;
  const conversation = parsed.conversationId
    ? (getConversation(parsed.conversationId) ?? createConversation(parsed.conversationId))
    : createConversation();

  const history = getMessages(conversation.id);
  const isFirst = history.length === 0;
  insertMessage({ conversationId: conversation.id, role: "user", content: message });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(sse(obj));
      try {
        // Title the conversation (first turn only) while we prepare the answer.
        const titlePromise = isFirst ? deriveConversationTitle(message) : Promise.resolve(null);

        const prep = await prepareTurn(history, message);
        const citations = toCitations(prep.retrieval.chunks);

        send({
          type: "meta",
          conversationId: conversation.id,
          escalated: prep.escalate,
          confidence: Number(prep.retrieval.confidence.toFixed(3)),
          topic: prep.topic,
          reason: prep.reason,
          citations,
        });

        let answer = "";

        if (prep.escalate) {
          // ── Escalation path ──────────────────────────────────────────────
          send({ type: "status", state: "escalating" });
          answer = escalationReply(prep.topic);
          // "Type out" the handoff message for a natural feel.
          for (const word of answer.match(/\S+\s*/g) ?? [answer]) {
            send({ type: "token", value: word });
            await tick();
          }

          const handoff = await generateHandoff(
            history,
            message,
            prep.topic,
            prep.reason,
            prep.retrieval.confidence,
          );

          const assistantMsg = insertMessage({
            conversationId: conversation.id,
            role: "assistant",
            content: answer,
            confidence: prep.retrieval.confidence,
            escalated: true,
            topic: prep.topic,
            citations: JSON.stringify(citations),
          });

          insertEscalation({
            conversationId: conversation.id,
            reason: prep.reason,
            confidence: prep.retrieval.confidence,
            topic: prep.topic,
            summary: handoff,
          });
          setConversationStatus(conversation.id, "escalated");
          insertQueryEvent({
            conversationId: conversation.id,
            messageId: assistantMsg.id,
            query: message,
            topic: prep.topic,
            confidence: prep.retrieval.confidence,
            resolved: false,
            escalated: true,
          });

          send({
            type: "done",
            messageId: assistantMsg.id,
            escalated: true,
            confidence: Number(prep.retrieval.confidence.toFixed(3)),
            topic: prep.topic,
            reason: prep.reason,
            citations,
            handoff,
          });
        } else {
          // ── Answer path ──────────────────────────────────────────────────
          const messages = buildAnswerMessages(history, message, prep.retrieval.chunks);
          for await (const delta of chatStream(messages, { temperature: 0.3 })) {
            answer += delta;
            send({ type: "token", value: delta });
          }
          if (!answer.trim()) answer = "I'm sorry, I wasn't able to generate a response. Please try again.";

          const assistantMsg = insertMessage({
            conversationId: conversation.id,
            role: "assistant",
            content: answer,
            confidence: prep.retrieval.confidence,
            escalated: false,
            topic: prep.topic,
            citations: JSON.stringify(citations),
          });
          insertQueryEvent({
            conversationId: conversation.id,
            messageId: assistantMsg.id,
            query: message,
            topic: prep.topic,
            confidence: prep.retrieval.confidence,
            resolved: true,
            escalated: false,
          });

          send({
            type: "done",
            messageId: assistantMsg.id,
            escalated: false,
            confidence: Number(prep.retrieval.confidence.toFixed(3)),
            topic: prep.topic,
            reason: prep.reason,
            citations,
          });
        }

        const title = await titlePromise;
        if (title) setConversationTitle(conversation.id, title);
      } catch (err) {
        send({ type: "error", message: (err as Error).message || "Something went wrong." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function tick() {
  return new Promise((r) => setTimeout(r, 18));
}
