import { guardJson } from "@/lib/server/guard";
import { isEventName, parseCommon } from "@/lib/track/schema";
import { saveEvent } from "@/lib/track/store";

const MAX_BYTES = 8_000;
const PER_MINUTE = 120;

export async function POST(request: Request): Promise<Response> {
  const guarded = await guardJson(request, { route: "track", limit: PER_MINUTE, maxBytes: MAX_BYTES });
  if (!guarded.ok) return guarded.response;
  const body = guarded.body;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "invalid event" }, { status: 400 });
  }
  const b = body as { name?: unknown; props?: unknown; common?: unknown };
  const common = parseCommon(b.common);
  if (!isEventName(b.name) || !common) return Response.json({ error: "invalid event" }, { status: 400 });
  if (b.props !== undefined && (typeof b.props !== "object" || b.props === null || Array.isArray(b.props))) {
    return Response.json({ error: "invalid event" }, { status: 400 });
  }
  const props = (b.props ?? {}) as Record<string, unknown>;
  try {
    const stored = await saveEvent({ name: b.name, props, common: { ...common } });
    return Response.json({ stored }, { status: 202 });
  } catch (err) {
    console.error("track failed", (err as Error).message);
    return Response.json({ error: "store failed" }, { status: 500 });
  }
}
