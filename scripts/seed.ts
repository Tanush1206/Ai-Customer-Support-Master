// Seeds the Nimbus knowledge base by POSTing each document in data/seed/ to the
// running server's /api/ingest endpoint. Idempotent: skips docs already ingested.
//
//   1. Start the app:  npm run dev   (or npm run build && npm start)
//   2. In another shell: npm run seed
//
// Override the target with BASE_URL=http://host:port

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SEED_DIR = join(process.cwd(), "data", "seed");

interface ManifestEntry {
  filename: string;
  title: string;
  topic: string;
  sourceType: "markdown" | "text";
}

function loadManifest(): ManifestEntry[] {
  try {
    return JSON.parse(readFileSync(join(SEED_DIR, "manifest.json"), "utf8")) as ManifestEntry[];
  } catch {
    // Fall back to every .md file in the directory.
    return readdirSync(SEED_DIR)
      .filter((f) => f.endsWith(".md"))
      .map((filename) => ({
        filename,
        title: filename.replace(/\.md$/, ""),
        topic: "Other",
        sourceType: "markdown" as const,
      }));
  }
}

async function serverUp(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/ingest`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function existingSourceNames(): Promise<Set<string>> {
  try {
    const res = await fetch(`${BASE_URL}/api/ingest`);
    const data = (await res.json()) as { documents: { source_name: string }[] };
    return new Set(data.documents.map((d) => d.source_name));
  } catch {
    return new Set();
  }
}

async function main() {
  console.log(`\n  Nimbus knowledge-base seeder → ${BASE_URL}\n`);

  if (!(await serverUp())) {
    console.error(
      `  ✗ Cannot reach the server at ${BASE_URL}.\n` +
        `    Start it first ("npm run dev") and ensure GEMINI_API_KEY + OPENROUTER_API_KEY are set in .env.\n`,
    );
    process.exit(1);
  }

  const manifest = loadManifest();
  const already = await existingSourceNames();
  let ingested = 0;
  let skipped = 0;
  let totalChunks = 0;

  for (const entry of manifest) {
    if (already.has(entry.filename)) {
      console.log(`  · skip   ${entry.filename} (already ingested)`);
      skipped++;
      continue;
    }
    const content = readFileSync(join(SEED_DIR, entry.filename), "utf8");
    process.stdout.write(`  … ingest ${entry.filename} [${entry.topic}] `);
    const res = await fetch(`${BASE_URL}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "markdown",
        name: entry.filename,
        title: entry.title,
        content,
        topic: entry.topic,
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      console.log(`✗ ${res.status} ${err.error ?? ""}`);
      if (res.status === 503) {
        console.error(`\n  Set GEMINI_API_KEY + OPENROUTER_API_KEY in .env and restart the server.\n`);
        process.exit(1);
      }
      continue;
    }
    const data = (await res.json()) as { chunkCount: number };
    totalChunks += data.chunkCount;
    ingested++;
    console.log(`✓ ${data.chunkCount} chunks`);
  }

  console.log(
    `\n  Done. ${ingested} ingested, ${skipped} skipped, ${totalChunks} new chunks embedded.\n` +
      `  The agent is now grounded — open ${BASE_URL} to chat, or run "npm run eval".\n`,
  );
}

await main();
