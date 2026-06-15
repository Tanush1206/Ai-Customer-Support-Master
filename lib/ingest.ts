import { convert as htmlToText } from "html-to-text";
import { chunkText } from "./chunk";
import { embedBatch } from "./embeddings";
import { insertDocument } from "./store";
import type { DocumentRecord, SourceType, Topic } from "./types";

export interface IngestResult {
  document: DocumentRecord;
  chunkCount: number;
}

interface RawInput {
  sourceType: SourceType;
  sourceName: string;
  title: string;
  text: string;
  topic?: Topic | null;
}

/** Shared path: chunk → embed → persist. */
export async function ingestRaw(input: RawInput): Promise<IngestResult> {
  const chunks = chunkText(input.text, input.title);
  if (chunks.length === 0) {
    throw new Error(`No extractable text found in "${input.sourceName}"`);
  }
  const embeddings = await embedBatch(chunks.map((c) => c.content));
  const document = insertDocument({
    sourceType: input.sourceType,
    sourceName: input.sourceName,
    title: input.title,
    topic: input.topic ?? null,
    chunks,
    embeddings,
  });
  return { document, chunkCount: chunks.length };
}

export function ingestMarkdown(opts: {
  name: string;
  title?: string;
  content: string;
  topic?: Topic | null;
}): Promise<IngestResult> {
  const title = opts.title ?? deriveTitle(opts.content) ?? opts.name;
  return ingestRaw({
    sourceType: "markdown",
    sourceName: opts.name,
    title,
    text: opts.content,
    topic: opts.topic,
  });
}

export async function ingestPdf(opts: {
  name: string;
  buffer: ArrayBuffer | Uint8Array;
  title?: string;
  topic?: Topic | null;
}): Promise<IngestResult> {
  // Imported lazily — unpdf is server-only and heavy.
  const { extractText, getDocumentProxy } = await import("unpdf");
  const data = opts.buffer instanceof Uint8Array ? opts.buffer : new Uint8Array(opts.buffer);
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  const fullText = Array.isArray(text) ? text.join("\n\n") : text;
  return ingestRaw({
    sourceType: "pdf",
    sourceName: opts.name,
    title: opts.title ?? opts.name.replace(/\.pdf$/i, ""),
    text: fullText,
    topic: opts.topic,
  });
}

/** Reject non-http(s) schemes and obvious internal/loopback/link-local hosts (basic SSRF guard). */
function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs can be ingested");
  }
  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (blocked) throw new Error("Refusing to fetch an internal or loopback address");
  return url;
}

export async function ingestUrl(opts: { url: string; topic?: Topic | null }): Promise<IngestResult> {
  const safe = assertSafeUrl(opts.url);
  const res = await fetch(safe, {
    headers: { "User-Agent": "NimbusSupportBot/1.0 (+ingestion)" },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${opts.url} (${res.status})`);
  const html = await res.text();

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const text = htmlToText(html, {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
      { selector: "nav", format: "skip" },
      { selector: "footer", format: "skip" },
      { selector: "script", format: "skip" },
      { selector: "style", format: "skip" },
    ],
  });

  return ingestRaw({
    sourceType: "url",
    sourceName: opts.url,
    title: titleMatch?.[1]?.trim() || opts.url,
    text,
    topic: opts.topic,
  });
}

function deriveTitle(markdown: string): string | null {
  const h1 = markdown.match(/^#\s+(.+)$/m);
  return h1?.[1]?.trim() ?? null;
}
