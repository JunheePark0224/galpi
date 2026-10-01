import { cutText, EVENT_SPEC, type EventName, type PropSpec } from "./schema";

/** Longest free string kept when the spec sets no `max` (book ids, topic and keyword keys are far shorter). */
const MAX_TEXT = 200;
/** Longest list kept (keywords are at most 5, changed_items at most 9). */
const MAX_ITEMS = 20;
const INVALID = Symbol("invalid");

/** Own keys only, so "constructor" or "__proto__" never match a spec entry. */
function specOf(name: EventName, key: string): PropSpec | null {
  const props: Readonly<Record<string, PropSpec>> = EVENT_SPEC[name];
  return Object.prototype.hasOwnProperty.call(props, key) ? props[key] : null;
}

function acceptsNull(spec: PropSpec): boolean {
  return typeof spec.type === "string" ? spec.nullable === true : spec.type.includes(null);
}

function cleanOne(spec: PropSpec, v: unknown): unknown {
  if (v === null) return acceptsNull(spec) ? null : INVALID;
  const t = spec.type;
  if (typeof t !== "string") return typeof v === "string" && t.includes(v) ? v : INVALID;
  if (t === "string") return typeof v === "string" ? cutText(v, spec.max ?? MAX_TEXT) : INVALID;
  if (t === "number") return typeof v === "number" && Number.isFinite(v) ? v : INVALID;
  if (t === "boolean") return typeof v === "boolean" ? v : INVALID;
  return typeof v === "object" && !Array.isArray(v) ? v : INVALID;   // "object" (art)
}

function clean(spec: PropSpec, v: unknown): unknown {
  if (!spec.array) return cleanOne(spec, v);
  if (!Array.isArray(v) || v.length > MAX_ITEMS) return INVALID;
  const items = v.map((item) => (item === null ? INVALID : cleanOne(spec, item)));
  return items.includes(INVALID) ? INVALID : items;
}

export interface ParsedProps {
  props: Record<string, unknown>;
  /** Keys that were not stored: unknown to the spec, Amplitude only, or the wrong type / value. */
  dropped: string[];
}

/**
 * Server check of an event's own props against EVENT_SPEC (taxonomy 7-3 ①: "모르는 속성 버리기").
 * The event is kept; only the keys that do not match are dropped and listed so the route can flag them.
 */
export function parseProps(name: EventName, raw: Record<string, unknown>): ParsedProps {
  const kept: [string, unknown][] = [];
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(raw)) {
    const spec = specOf(name, key);
    const cleaned = spec && spec.only !== "amplitude" ? clean(spec, value) : INVALID;
    if (cleaned === INVALID) dropped.push(key);
    else kept.push([key, cleaned]);
  }
  return { props: Object.fromEntries(kept), dropped };
}
