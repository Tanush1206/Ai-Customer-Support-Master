// Heading-aware recursive chunker. Targets ~400 tokens/chunk with overlap so
// retrieval returns coherent, self-contained passages.

export interface Chunk {
  heading: string;
  content: string;
}

const MAX_CHARS = 1600; // ~400 tokens
const OVERLAP_CHARS = 220;

/** Split text into chunks, tracking the nearest markdown heading for context. */
export function chunkText(text: string, docTitle: string): Chunk[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];

  // Break into sections at markdown headings (#, ##, ...).
  const lines = normalized.split("\n");
  const sections: { heading: string; body: string[] }[] = [];
  let current = { heading: docTitle, body: [] as string[] };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      if (current.body.join("").trim()) sections.push(current);
      current = { heading: headingMatch[2].trim() || docTitle, body: [] };
    } else {
      current.body.push(line);
    }
  }
  if (current.body.join("").trim()) sections.push(current);
  if (sections.length === 0) sections.push({ heading: docTitle, body: [normalized] });

  const chunks: Chunk[] = [];
  for (const section of sections) {
    const body = section.body.join("\n").trim();
    if (!body) continue;
    for (const piece of splitWithOverlap(body)) {
      chunks.push({
        heading: section.heading,
        content: `${section.heading}\n\n${piece}`.trim(),
      });
    }
  }
  return chunks;
}

function splitWithOverlap(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];

  // Prefer paragraph boundaries, fall back to sentence boundaries.
  const paragraphs = text.split(/\n\n+/);
  const pieces: string[] = [];
  let buf = "";

  const flush = () => {
    if (buf.trim()) pieces.push(buf.trim());
    buf = "";
  };

  for (const para of paragraphs) {
    if (para.length > MAX_CHARS) {
      flush();
      // Hard-split an oversized paragraph by sentences.
      const sentences = para.match(/[^.!?]+[.!?]+|\S+/g) ?? [para];
      let sBuf = "";
      for (const s of sentences) {
        if ((sBuf + s).length > MAX_CHARS) {
          if (sBuf.trim()) pieces.push(sBuf.trim());
          sBuf = s;
        } else {
          sBuf += s;
        }
      }
      if (sBuf.trim()) pieces.push(sBuf.trim());
      continue;
    }
    if ((buf + "\n\n" + para).length > MAX_CHARS) {
      flush();
      buf = para;
    } else {
      buf = buf ? `${buf}\n\n${para}` : para;
    }
  }
  flush();

  // Add trailing overlap from the previous piece for continuity.
  return pieces.map((piece, i) => {
    if (i === 0) return piece;
    const prev = pieces[i - 1];
    const overlap = prev.slice(-OVERLAP_CHARS);
    return `${overlap}\n\n${piece}`.trim();
  });
}
