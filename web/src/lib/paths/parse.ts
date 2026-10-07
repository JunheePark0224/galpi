import { AXES, type AxisKey, type Entry, type Tag, type Way } from "@/lib/recommend";
import type { Choice, Effects, FarRule, QNode, QuestionMap, Scope } from "./types";

export class MapParseError extends Error {}

const BLOCK = /```(node|far)\r?\n([\s\S]*?)```/g;
const WAYS: readonly Way[] = ["개념", "실습", "사례"];

function list(id: string, key: string, v: string): string[] {
  const out = v.split(",").map((s) => s.trim()).filter(Boolean);
  if (!out.length) throw new MapParseError(`node ${id}: ${key} is empty`);
  return out;
}

function tag(id: string, name: string, v: string): Tag {
  if (v === "+1" || v === "1") return 1;
  if (v === "-1") return -1;
  throw new MapParseError(`node ${id}: ${name} must be +1 or -1, got "${v}"`);
}

/** "label | k=v | k=v" → effects + next (+ hint). Scope-only parts are allowed in far rules (withNext = false). */
function parts(id: string, text: string, withNext: boolean): { label: string; effects: Effects; next: string | null; hint: string | null } {
  const [label, ...rest] = text.split("|").map((s) => s.trim());
  const effects: Effects = {};
  let next: string | null = null;
  let hint: string | null = null;
  for (const p of rest) {
    const eq = p.indexOf("=");
    if (eq < 0) throw new MapParseError(`node ${id}: "${p}" is not key=value`);
    const key = p.slice(0, eq).trim();
    const value = p.slice(eq + 1).trim();
    if (key === "next" && withNext) next = value;
    else if (key === "hint" && withNext) {
      if (!value) throw new MapParseError(`node ${id}: hint is empty`);
      hint = value;
    }
    else if (key === "entry" && (value === "leaf" || value === "target")) effects.entry = value as Entry;
    else if (key === "topics") effects.topics = list(id, key, value);
    else if (key === "keywords") effects.keywords = list(id, key, value);
    else if (key === "genres") effects.genres = list(id, key, value);
    else if ((AXES as readonly string[]).includes(key)) effects.axes = { ...effects.axes, [key as AxisKey]: tag(id, key, value) };
    else if (key === "len") effects.len = tag(id, key, value);
    else if (key === "way" && list(id, key, value).every((w) => (WAYS as readonly string[]).includes(w))) effects.ways = list(id, key, value) as Way[];
    else if (key === "mode" && (value === "normal" || value === "challenge")) effects.mode = value;
    else throw new MapParseError(`node ${id}: unknown effect "${key}=${value}"`);
  }
  return { label, effects, next, hint };
}

function field(id: string, lines: Map<string, string>, key: string): string {
  const v = lines.get(key);
  if (v === undefined || v === "") throw new MapParseError(`node ${id}: missing "${key}:" line`);
  return v;
}

function choice(id: string, text: string): Choice {
  const { label, effects, next, hint } = parts(id, text, true);
  if (!label) throw new MapParseError(`node ${id}: a choice has no label`);
  if (!next) throw new MapParseError(`node ${id}: choice "${label}" has no next=`);
  return { label, ...(hint ? { hint } : {}), effects, next };
}

/** "key: value" lines of a block, and the keys given more than once. */
function linesOf(body: string): { lines: Map<string, string>; twice: string[] } {
  const lines = new Map<string, string>();
  const twice: string[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const colon = line.indexOf(":");
    if (!line || colon < 0) continue;
    const key = line.slice(0, colon).trim();
    if (lines.has(key)) twice.push(key);
    lines.set(key, line.slice(colon + 1).trim());
  }
  return { lines, twice };
}

function once(where: string, twice: string[]): void {
  if (twice.length) throw new MapParseError(`${where}: "${twice[0]}:" line appears twice`);
}

function scopeOf(side: "from" | "to", text: string): Partial<Scope> {
  const { effects } = parts("far", `rule | ${text}`, false);
  const { entry, topics, keywords, genres } = effects;
  const scope = { ...(entry ? { entry } : {}), ...(topics ? { topics } : {}), ...(keywords ? { keywords } : {}), ...(genres ? { genres } : {}) };
  if (!Object.keys(scope).length) throw new MapParseError(`far: ${side} sets no scope (entry, topics, keywords or genres)`);
  return scope;
}

const FAR_KEYS = ["from", "to", "pick", "why"];
const HEADING = /^(\d+)\.\s+(.+)$/;

/** The "N. title" line right above a far block (optional). */
function headingOf(before: string): { n: number; title: string } | undefined {
  const last = before.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).at(-1);
  const m = last?.match(HEADING);
  return m ? { n: Number(m[1]), title: m[2] } : undefined;
}

function farRule(lines: Map<string, string>, n: number, heading: { n: number; title: string } | undefined): FarRule {
  const where = `far ${n}`;
  const extra = [...lines.keys()].find((k) => !FAR_KEYS.includes(k));
  if (extra) throw new MapParseError(`${where}: unknown line "${extra}:"`);
  const pick = lines.get("pick");
  if (pick !== undefined && pick !== "one") throw new MapParseError(`${where}: pick must be "one", got "${pick}"`);
  const why = lines.get("why");
  if (why === "") throw new MapParseError(`${where}: why is empty`);
  const to = scopeOf("to", field("far", lines, "to"));
  if (pick && !to.genres) throw new MapParseError(`${where}: pick: one needs a genres list in to:`);
  return {
    from: scopeOf("from", field("far", lines, "from")), to,
    ...(heading ? { n: heading.n, title: heading.title } : {}), ...(pick ? { pick } : {}), ...(why ? { why } : {}),
  };
}

export function parseQuestionMap(markdown: string): QuestionMap {
  const nodes: Record<string, QNode> = {};
  const far: FarRule[] = [];
  let start: string | null = null;
  let after = 0;
  for (const m of markdown.matchAll(BLOCK)) {
    const before = markdown.slice(after, m.index);
    after = m.index + m[0].length;
    const { lines, twice } = linesOf(m[2]);
    if (m[1] === "far") {
      once("far", twice);
      const heading = headingOf(before);
      const n = heading?.n ?? far.length + 1;
      if (far.some((r, i) => (r.n ?? i + 1) === n)) throw new MapParseError(`far ${n}: the number ${n} is used twice — each far rule keeps its own number`);
      far.push(farRule(lines, n, heading));
      continue;
    }
    const id = field("?", lines, "id");
    once(`node ${id}`, twice);
    if (nodes[id]) throw new MapParseError(`node ${id}: id used twice`);
    const kind = field(id, lines, "kind");
    if (kind !== "narrow" && kind !== "mood") throw new MapParseError(`node ${id}: kind must be narrow or mood`);
    const unsure = parts(id, `unsure | ${field(id, lines, "unsure")}`, true);
    if (!unsure.next) throw new MapParseError(`node ${id}: unsure has no next=`);
    if (Object.keys(unsure.effects).length || unsure.hint) throw new MapParseError(`node ${id}: unsure may only have next=`);
    nodes[id] = {
      id, kind, question: field(id, lines, "question"),
      a: choice(id, field(id, lines, "A")), b: choice(id, field(id, lines, "B")), unsureNext: unsure.next,
    };
    start ??= id;
  }
  if (start === null) throw new MapParseError("no node blocks found");
  return { start, nodes, far };
}
