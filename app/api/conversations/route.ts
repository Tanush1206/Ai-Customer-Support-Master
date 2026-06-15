import { createConversation, listConversations } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ conversations: listConversations() });
}

export async function POST() {
  return Response.json({ conversation: createConversation() });
}
