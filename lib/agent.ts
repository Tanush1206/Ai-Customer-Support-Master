import { chat, chatJSON, type ChatMessage } from "./openrouter";
import { retrieve, isConfident, type RetrievalOutcome } from "./rag";
import { config } from "./config";
import { TOPICS } from "./types";
import type { Citation, HandoffSummary, MessageRecord, RetrievedChunk, Topic } from "./types";

const HISTORY_LIMIT = 12;

/** Convert stored messages into OpenRouter chat turns (agent→assistant). */
export function historyToChatMessages(history: MessageRecord[]): ChatMessage[] {
  return history
    .filter((m) => m.role !== "system")
    .slice(-HISTORY_LIMIT)
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));
}

function normalizeTopic(value: unknown): Topic {
  const t = String(value ?? "").trim();
  return (TOPICS as readonly string[]).includes(t) ? (t as Topic) : "Other";
}

/**
 * Step 1 — rewrite the latest (possibly elliptical) user message into a
 * standalone search query using the conversation so far, and tag its topic.
 * This is what makes follow-ups like "what about the Pro plan?" retrievable.
 */
export async function contextualize(
  history: MessageRecord[],
  userMessage: string,
): Promise<{ standaloneQuery: string; topic: Topic }> {
  if (history.length === 0) {
    // No context to resolve against — still classify the topic.
    const t = await classifyTopic(userMessage);
    return { standaloneQuery: userMessage, topic: t };
  }

  const transcript = historyToChatMessages(history)
    .map((m) => `${m.role === "user" ? "Customer" : "Agent"}: ${m.content}`)
    .join("\n");

  try {
    const result = await chatJSON<{ standalone_query: string; topic: string }>(
      [
        {
          role: "system",
          content:
            "You rewrite a customer's latest message into a fully self-contained search query, " +
            "resolving pronouns and references using the conversation. Also classify the topic.\n" +
            `Valid topics: ${TOPICS.join(", ")}.\n` +
            'Use "Out of Scope" for anything unrelated to the Nimbus cloud storage product ' +
            "(e.g. weather, other companies, legal/medical advice, jokes).\n" +
            'Respond as JSON: {"standalone_query": string, "topic": string}.',
        },
        {
          role: "user",
          content: `Conversation so far:\n${transcript}\n\nLatest customer message: "${userMessage}"`,
        },
      ],
      { model: config.openrouter.utilityModel, temperature: 0 },
    );
    return {
      standaloneQuery: result.standalone_query?.trim() || userMessage,
      topic: normalizeTopic(result.topic),
    };
  } catch {
    return { standaloneQuery: userMessage, topic: await classifyTopic(userMessage) };
  }
}

async function classifyTopic(text: string): Promise<Topic> {
  try {
    const result = await chatJSON<{ topic: string }>(
      [
        {
          role: "system",
          content:
            `Classify the customer message into one topic. Valid topics: ${TOPICS.join(", ")}. ` +
            'Use "Out of Scope" for anything unrelated to the Nimbus cloud storage product. ' +
            'Respond as JSON: {"topic": string}.',
        },
        { role: "user", content: text },
      ],
      { model: config.openrouter.utilityModel, temperature: 0 },
    );
    return normalizeTopic(result.topic);
  } catch {
    return "Other";
  }
}

export interface PreparedTurn {
  standaloneQuery: string;
  topic: Topic;
  retrieval: RetrievalOutcome;
  escalate: boolean;
  reason: string;
}

/** Steps 1–3: contextualize, retrieve, and apply the escalation gate. */
export async function prepareTurn(
  history: MessageRecord[],
  userMessage: string,
): Promise<PreparedTurn> {
  const { standaloneQuery, topic } = await contextualize(history, userMessage);
  const retrieval = await retrieve(standaloneQuery);

  let escalate = false;
  let reason = "Resolved by AI from the knowledge base.";

  if (topic === "Out of Scope") {
    escalate = true;
    reason = "Query is outside the scope of the Nimbus product knowledge base.";
  } else if (!isConfident(retrieval.confidence)) {
    escalate = true;
    reason =
      `Retrieval confidence ${retrieval.confidence.toFixed(2)} is below the ` +
      `${config.rag.confidenceThreshold} threshold — no sufficiently relevant documentation found.`;
  }

  return { standaloneQuery, topic, retrieval, escalate, reason };
}

const ANSWER_SYSTEM = `You are Nimbus Support, the AI assistant for Nimbus — a cloud storage and collaboration product.

Rules:
- Answer ONLY using the CONTEXT passages provided below. Do not invent features, prices, or steps.
- If the context does not fully answer the question, say what you *can* answer and note that you'll connect them to a specialist for the rest. Never guess.
- Be warm, concise, and direct. Use short paragraphs and numbered steps for procedures.
- When you state a specific fact (a limit, price, setting), it must come from the context.
- Format with Markdown. Do not output raw passage IDs or mention "the context"; just answer naturally.`;

/** Build the messages for the grounded streaming answer. */
export function buildAnswerMessages(
  history: MessageRecord[],
  userMessage: string,
  chunks: RetrievedChunk[],
): ChatMessage[] {
  const context = chunks
    .map((c, i) => `[Passage ${i + 1} — ${c.title}]\n${c.content}`)
    .join("\n\n---\n\n");

  return [
    { role: "system", content: ANSWER_SYSTEM },
    ...historyToChatMessages(history),
    {
      role: "user",
      content: `CONTEXT:\n${context || "(no relevant documentation found)"}\n\nCUSTOMER QUESTION: ${userMessage}`,
    },
  ];
}

/** Map retrieved chunks to compact citations for the UI. */
export function toCitations(chunks: RetrievedChunk[]): Citation[] {
  return chunks.slice(0, 4).map((c) => ({
    chunkId: c.chunkId,
    documentId: c.documentId,
    title: c.title,
    score: Number(c.score.toFixed(3)),
    snippet: c.content.replace(/\s+/g, " ").slice(0, 180).trim() + "…",
  }));
}

/** The short, empathetic message shown to the customer when we escalate. */
export function escalationReply(topic: Topic): string {
  return (
    `I want to make sure you get an accurate answer on this, so I'm connecting you with a member of our ` +
    `${topic === "Out of Scope" ? "support" : topic} team. ` +
    `I've shared a full summary of our conversation with them, so you won't need to repeat anything. ` +
    `They'll pick this up from here. 🤝`
  );
}

/**
 * Generate the structured handoff a human agent reads instead of the thread.
 */
export async function generateHandoff(
  history: MessageRecord[],
  userMessage: string,
  topic: Topic,
  reason: string,
  confidence: number,
): Promise<HandoffSummary> {
  const transcript = [...historyToChatMessages(history), { role: "user" as const, content: userMessage }]
    .map((m) => `${m.role === "user" ? "Customer" : "AI Agent"}: ${m.content}`)
    .join("\n");

  const fallback: HandoffSummary = {
    customerGoal: userMessage.slice(0, 200),
    conversationSummary: "Customer reached out; AI could not confidently resolve the request.",
    attemptedResolution: reason,
    keyFacts: [],
    suggestedNextSteps: ["Review the conversation and respond to the customer directly."],
    sentiment: "neutral",
    topic,
  };

  try {
    const result = await chatJSON<HandoffSummary>(
      [
        {
          role: "system",
          content:
            "You write a concise handoff summary so a human support agent can take over WITHOUT re-reading the thread. " +
            "Be factual and specific. Respond as JSON with exactly these keys: " +
            "customerGoal (string), conversationSummary (string, 1-3 sentences), attemptedResolution (string), " +
            "keyFacts (string[] — concrete details: account tier, error messages, what was tried), " +
            "suggestedNextSteps (string[]), sentiment (one of: calm, neutral, frustrated, angry).",
        },
        {
          role: "user",
          content: `Topic: ${topic}\nWhy escalated: ${reason}\nRetrieval confidence: ${confidence.toFixed(2)}\n\nConversation:\n${transcript}`,
        },
      ],
      { model: config.openrouter.utilityModel, temperature: 0.1 },
    );
    return {
      customerGoal: result.customerGoal || fallback.customerGoal,
      conversationSummary: result.conversationSummary || fallback.conversationSummary,
      attemptedResolution: result.attemptedResolution || reason,
      keyFacts: Array.isArray(result.keyFacts) ? result.keyFacts : [],
      suggestedNextSteps: Array.isArray(result.suggestedNextSteps)
        ? result.suggestedNextSteps
        : fallback.suggestedNextSteps,
      sentiment: (["calm", "neutral", "frustrated", "angry"] as const).includes(result.sentiment)
        ? result.sentiment
        : "neutral",
      topic,
    };
  } catch {
    return fallback;
  }
}

/** A short conversation title derived from the first user message. */
export async function deriveConversationTitle(firstMessage: string): Promise<string> {
  try {
    const t = await chat(
      [
        {
          role: "system",
          content:
            "Write a 3-6 word title (no quotes, no trailing punctuation) summarizing this support request.",
        },
        { role: "user", content: firstMessage },
      ],
      { model: config.openrouter.utilityModel, temperature: 0.2, maxTokens: 20 },
    );
    return t.trim().replace(/^["']|["']$/g, "").slice(0, 60) || firstMessage.slice(0, 50);
  } catch {
    return firstMessage.slice(0, 50);
  }
}
