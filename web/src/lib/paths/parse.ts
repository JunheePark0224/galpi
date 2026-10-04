import { AXES, type AxisKey, type Entry, type Tag, type Way } from "@/lib/recommend";
import type { Choice, Effects, FarRule, QNode, QuestionMap, Scope } from "./types";

export class MapParseError extends Error {}

const BLOCK = /```(node|far)\r?\n([\s\S]*?)```/g;
const WAYS: readonly Way[] = ["개념", "실습", "사례"];
const list = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

function tag(id: string, name: string, v: string): Tag {
  if (v === "+1" || v === "1") return 1;
  if (v === "-1") return -1;
  throw new MapParseError(`node ${id}: ${name} must be +1 or -1, got "${v}"`);
}

/** "label | k=v | k=v" → effects + next. Scope-only parts are allowed in far rules (withNext = false). */
function parts(id: string, text: string, withNext: boolean): { label: string; effects: Effects; next: string | null } {
  const [label, ...rest] = text.split("|").map((s) => s.trim());
  const effects: Effects = {};
  let next: string | null = null;
  for (const p of rest) {
    const eq = p.indexOf("=");
    if (eq < 0) throw new MapParseError(`node ${id}: "${p}" is not key=value`);
    const key = p.slice(0, eq).trim();
    const value = p.slice(eq + 1).trim();
    if (key === "next" && withNext) next = value;
    else if (key === "entry" && (value === "leaf" || value === "target")) effects.entry = value as Entry;
    else if (key === "topics") effects.topics = list(value);
    else if (key === "keywords") effects.keywords = list(value);
    else if (key === "genres") effects.genres = list(value);
    else if ((AXES as readonly string[]).includes(key)) effects.axes = { ...effects.axes, [key as AxisKey]: tag(id, key, value) };
    else if (key === "len") effects.len = tag(id, key, value);
    else if (key === "way" && (WAYS as readonly string[]).includes(value)) effects.way = value as Way;
    else if (key === "mode" && (value === "normal" || value === "challenge")) effects.mode = value;
    else throw new MapParseError(`node ${id}: unknown effect "${key}=${value}"`);
  }
  return { label, effects, next };
}

function field(id: string, lines: Map<string, string>, key: string): string {
  const v = lines.get(key);
  if (v === undefined || v === "") throw new MapParseError(`node ${id}: missing "${key}:" line`);
  return v;
}

function choice(id: string, text: string): Choice {
  const { label, effects, next } = parts(id, text, true);
  if (!label) throw new MapParseError(`node ${id}: a choice has no label`);
  if (!next) throw new MapParseError(`node ${id}: choice "${label}" has no next=`);
  return { label, effects, next };
}

function linesOf(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const colon = line.indexOf(":");
    if (!line || colon < 0) continue;
    out.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
  }
  return out;
}

function scopeOf(id: string, text: string): Partial<Scope> {
  const { effects } = parts(id, `rule | ${text}`, false);
  const { entry, topics, keywords, genres } = effects;
  return { ...(entry ? { entry } : {}), ...(topics ? { topics } : {}), ...(keywords ? { keywords } : {}), ...(genres ? { genres } : {}) };
}

export function parseQuestionMap(markdown: string): QuestionMap {
  const nodes: Record<string, QNode> = {};
  const far: FarRule[] = [];
  let start: string | null = null;
  for (const m of markdown.matchAll(BLOCK)) {
    const lines = linesOf(m[2]);
    if (m[1] === "far") {
      far.push({ from: scopeOf("far", field("far", lines, "from")), to: scopeOf("far", field("far", lines, "to")) });
      continue;
    }
    const id = field("?", lines, "id");
    if (nodes[id]) throw new MapParseError(`node ${id}: id used twice`);
    const kind = field(id, lines, "kind");
    if (kind !== "narrow" && kind !== "mood") throw new MapParseError(`node ${id}: kind must be narrow or mood`);
    const unsure = parts(id, `unsure | ${field(id, lines, "unsure")}`, true);
    if (!unsure.next) throw new MapParseError(`node ${id}: unsure has no next=`);
    nodes[id] = {
      id, kind, question: field(id, lines, "question"),
      a: choice(id, field(id, lines, "A")), b: choice(id, field(id, lines, "B")), unsureNext: unsure.next,
    };
    start ??= id;
  }
  if (start === null) throw new MapParseError("no node blocks found");
  return { start, nodes, far };
}
