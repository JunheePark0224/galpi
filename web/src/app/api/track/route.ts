import { authClient, sessionUserId } from "@/lib/auth/server";
import { guardJson } from "@/lib/server/guard";
import { cleanJson, TooDeepError } from "@/lib/server/sanitize";
import { parseProps } from "@/lib/track/props";
import { cutText, isEventName, parseCommon } from "@/lib/track/schema";
import { saveEvent } from "@/lib/track/store";

const MAX_BYTES = 8_000;
const PER_MINUTE = 120;
/** A flagged event names at most this many dropped keys, each cut short: the log line stays small whatever the body held. */
const MAX_LOGGED_KEYS = 10;
const MAX_LOGGED_KEY = 40;

/** Supabase Auth keeps the session in cookies named sb-<project>-auth-token(.0, .1 …). */
const hasAuthCookie = (req: Request): boolean => /(?:^|;\s*)sb-[^=;]*-auth-token/.test(req.headers.get("cookie") ?? "");

/**
 * taxonomy 3-2 (v0.8): common.user_id is the logged-in person's Supabase id as this server verifies it from the session
 * cookie — whatever the browser wrote there is dropped, so nobody can file events under someone else's id.
 */
async function verifiedUserId(req: Request): Promise<string | null> {
  if (!hasAuthCookie(req)) return null;
  try {
    const client = await authClient();
    return client ? await sessionUserId(client) : null;
  } catch {
    return null;              // the event still counts — as not logged in — rather than being lost
  }
}

export async function POST(request: Request): Promise<Response> {
  const guarded = await guardJson(request, { route: "track", limit: PER_MINUTE, maxBytes: MAX_BYTES });
  if (!guarded.ok) return guarded.response;
  let body: unknown;
  try {
    body = cleanJson(guarded.body);
  } catch (err) {
    if (err instanceof TooDeepError) return Response.json({ error: "invalid event" }, { status: 400 });
    throw err;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "invalid event" }, { status: 400 });
  }
  const b = body as { name?: unknown; props?: unknown; common?: unknown };
  const common = parseCommon(b.common);
  if (!isEventName(b.name) || !common) return Response.json({ error: "invalid event" }, { status: 400 });
  if (b.props !== undefined && (typeof b.props !== "object" || b.props === null || Array.isArray(b.props))) {
    return Response.json({ error: "invalid event" }, { status: 400 });
  }
  // taxonomy 7-3 ①: keep the event, store only the props EVENT_SPEC defines, flag the rest by name (never by value).
  const { props, dropped } = parseProps(b.name, (b.props ?? {}) as Record<string, unknown>);
  if (dropped.length > 0) {
    const keys = dropped.slice(0, MAX_LOGGED_KEYS).map((k) => cutText(k, MAX_LOGGED_KEY));
    console.warn("track: dropped props", JSON.stringify({ name: b.name, keys }));
  }
  try {
    const stored = await saveEvent({ name: b.name, props, common: { ...common, user_id: await verifiedUserId(request) } });
    return Response.json({ stored }, { status: 202 });
  } catch (err) {
    console.error("track failed", (err as Error).message);
    return Response.json({ error: "store failed" }, { status: 500 });
  }
}
