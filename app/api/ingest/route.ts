import { assertLLMKeys } from "@/lib/config";
import { ingestMarkdown, ingestPdf, ingestUrl, ingestRaw } from "@/lib/ingest";
import { deleteDocument, listDocuments } from "@/lib/store";
import { TOPICS, type Topic } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function topicOrNull(v: unknown): Topic | null {
  const s = String(v ?? "").trim();
  return (TOPICS as readonly string[]).includes(s) ? (s as Topic) : null;
}

export async function GET() {
  return Response.json({ documents: listDocuments() });
}

export async function POST(req: Request) {
  try {
    assertLLMKeys();
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  try {
    // ── File upload (PDF / Markdown) ──────────────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const topic = topicOrNull(form.get("topic"));
      if (!(file instanceof File)) {
        return Response.json({ error: "No file provided" }, { status: 400 });
      }
      const name = file.name || "upload";
      if (/\.pdf$/i.test(name)) {
        const buf = await file.arrayBuffer();
        const result = await ingestPdf({ name, buffer: buf, topic });
        return Response.json(result);
      }
      const text = await file.text();
      const result = await ingestMarkdown({ name, content: text, topic });
      return Response.json(result);
    }

    // ── JSON body (markdown / url / text) ────────────────────────────────
    const body = (await req.json()) as Record<string, unknown>;
    const kind = String(body.kind ?? "");
    const topic = topicOrNull(body.topic);

    if (kind === "url") {
      if (!body.url) return Response.json({ error: "url is required" }, { status: 400 });
      const result = await ingestUrl({ url: String(body.url), topic });
      return Response.json(result);
    }
    if (kind === "markdown" || kind === "text") {
      const content = String(body.content ?? "");
      if (!content.trim()) return Response.json({ error: "content is required" }, { status: 400 });
      const name = String(body.name ?? "pasted-document");
      if (kind === "text") {
        const result = await ingestRaw({
          sourceType: "text",
          sourceName: name,
          title: String(body.title ?? name),
          text: content,
          topic,
        });
        return Response.json(result);
      }
      const result = await ingestMarkdown({
        name,
        title: body.title ? String(body.title) : undefined,
        content,
        topic,
      });
      return Response.json(result);
    }

    return Response.json({ error: "Unknown ingest kind" }, { status: 400 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id query param required" }, { status: 400 });
  deleteDocument(id);
  return Response.json({ ok: true });
}
