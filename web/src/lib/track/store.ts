import "server-only";
import { createClient } from "@supabase/supabase-js";

export interface IncomingEvent { name: string; props: Record<string, unknown>; common: Record<string, unknown> }

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const storeOff = process.env.TRACK_STORE === "off";
const client = !storeOff && url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

/** Returns true when stored, false when Supabase is not configured or TRACK_STORE=off (local dev, E2E). Throws on DB errors. */
export async function saveEvent(e: IncomingEvent): Promise<boolean> {
  if (!client) return false;
  const { error } = await client.from("events").insert({ name: e.name, props: e.props, common: e.common });
  if (error) throw new Error(`events insert failed: ${error.code}`);
  return true;
}
