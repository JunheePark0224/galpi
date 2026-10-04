import { authClient, sessionUserId } from "@/lib/auth/server";
import type { CommonProps, EventName } from "./schema";
import { saveEvent } from "./store";

/** Supabase Auth keeps the session in cookies named sb-<project>-auth-token(.0, .1 …). */
const hasAuthCookie = (req: Request): boolean => /(?:^|;\s*)sb-[^=;]*-auth-token/.test(req.headers.get("cookie") ?? "");

/**
 * taxonomy 3-2 (v0.8): common.user_id is the logged-in person's Supabase id as this server verifies it from the session
 * cookie — whatever the browser wrote there is dropped, so nobody can file events under someone else's id.
 */
export async function verifiedUserId(req: Request): Promise<string | null> {
  if (!hasAuthCookie(req)) return null;
  try {
    const client = await authClient();
    return client ? await sessionUserId(client) : null;
  } catch {
    return null;              // the event still counts — as not logged in — rather than being lost
  }
}

/**
 * The one server path into `events` (/api/track for every event, /api/feedback for E-31): props already checked against
 * EVENT_SPEC, common already parsed, user_id replaced by the verified one. Returns saveEvent's answer; throws on DB errors.
 */
export async function recordEvent(
  req: Request,
  e: { name: EventName; props: Record<string, unknown>; common: CommonProps },
): Promise<boolean> {
  return saveEvent({ name: e.name, props: e.props, common: { ...e.common, user_id: await verifiedUserId(req) } });
}
