import { isEventName } from "@/lib/track/schema";
import { saveEvent } from "@/lib/track/store";

const MAX_BYTES = 8_000;

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  if (raw.length > MAX_BYTES) return Response.json({ error: "too large" }, { status: 400 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const b = body as { name?: unknown; props?: unknown; common?: unknown };
  if (!isEventName(b.name) || typeof b.common !== "object" || b.common === null) {
    return Response.json({ error: "invalid event" }, { status: 400 });
  }
  const props = typeof b.props === "object" && b.props !== null ? (b.props as Record<string, unknown>) : {};
  try {
    const stored = await saveEvent({ name: b.name, props, common: b.common as Record<string, unknown> });
    return Response.json({ stored }, { status: 202 });
  } catch (err) {
    console.error("track failed", (err as Error).message);
    return Response.json({ error: "store failed" }, { status: 500 });
  }
}
