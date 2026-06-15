import { config } from "./config";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  model?: string;
  temperature?: number;
  jsonMode?: boolean;
  maxTokens?: number;
}

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.openrouter.apiKey}`,
    "HTTP-Referer": config.openrouter.siteUrl,
    "X-Title": config.openrouter.siteName,
  };
}

/** Non-streaming completion — returns the full assistant string. */
export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  if (!config.openrouter.apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  const res = await fetch(`${config.openrouter.baseUrl}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: opts.model ?? config.openrouter.model,
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenRouter chat failed (${res.status}): ${detail.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return json.choices[0]?.message?.content ?? "";
}

/** Completion that returns parsed JSON of type T. Strips code fences if present. */
export async function chatJSON<T>(messages: ChatMessage[], opts: ChatOptions = {}): Promise<T> {
  const raw = await chat(messages, { ...opts, jsonMode: true });
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Last-ditch: extract the first {...} block.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error(`Expected JSON from model, got: ${raw.slice(0, 300)}`);
  }
}

/** Streaming completion — yields text deltas as they arrive. */
export async function* chatStream(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): AsyncGenerator<string, void, unknown> {
  if (!config.openrouter.apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  const res = await fetch(`${config.openrouter.baseUrl}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: opts.model ?? config.openrouter.model,
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const detail = res.body ? await res.text() : res.statusText;
    throw new Error(`OpenRouter stream failed (${res.status}): ${String(detail).slice(0, 500)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by double newlines.
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      if (!data) continue;
      try {
        const json = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Ignore keep-alive comments / partial frames.
      }
    }
  }
}
