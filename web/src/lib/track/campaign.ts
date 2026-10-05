import { UTM_MAX } from "./schema";

/** taxonomy v1.4 E-01: the link tags read from the landing address (first touch), in this order. */
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type Campaign = Record<UtmKey, string | null>;

export const NO_CAMPAIGN: Campaign = Object.freeze({ utm_source: null, utm_medium: null, utm_campaign: null });

const UTM_VALUE = new RegExp(`^[a-z0-9_-]{1,${UTM_MAX}}$`);

/** Lowercased; kept only when it is 1–40 of [a-z0-9_-]. Anything else (spaces, Korean, an e-mail, too long) is null. */
export function cleanUtm(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.toLowerCase();
  return UTM_VALUE.test(value) ? value : null;
}

/** The three tags of an address's query string (a new object), each cleaned. */
export function campaignFrom(search: string): Campaign {
  const params = new URLSearchParams(search);
  return { utm_source: cleanUtm(params.get("utm_source")), utm_medium: cleanUtm(params.get("utm_medium")), utm_campaign: cleanUtm(params.get("utm_campaign")) };
}

/** A stored campaign read back (sessionStorage is the visitor's): each value cleaned again, anything unreadable → none. */
export function parseCampaign(json: string): Campaign {
  try {
    const raw: unknown = JSON.parse(json);
    if (typeof raw !== "object" || raw === null) return NO_CAMPAIGN;
    const r = raw as Record<string, unknown>;
    return { utm_source: cleanUtm(r.utm_source), utm_medium: cleanUtm(r.utm_medium), utm_campaign: cleanUtm(r.utm_campaign) };
  } catch {
    return NO_CAMPAIGN;
  }
}

/** The same address without any utm_* parameter, or null when there is none to take off. Keeps the path, other params and hash. */
export function withoutCampaign(pathname: string, search: string, hash: string): string | null {
  const params = new URLSearchParams(search);
  const tags = [...params.keys()].filter((key) => key.toLowerCase().startsWith("utm_"));
  if (tags.length === 0) return null;
  for (const key of new Set(tags)) params.delete(key);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

/**
 * Takes the utm tags off the address bar once they are read, so a link copied from here does not carry our tags on
 * (a friend's visit would count as the campaign). Native history.replaceState is integrated with the Next router
 * (usePathname / useSearchParams stay in sync); the router's history state is kept, as LoginReturn does.
 */
export function stripCampaignFromAddress(): void {
  try {
    const { pathname, search, hash } = window.location;
    const next = withoutCampaign(pathname, search, hash);
    if (next !== null) window.history.replaceState(window.history.state, "", next);
  } catch {
    // the address staying as it was is harmless
  }
}
