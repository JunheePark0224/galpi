import type { Choice, Effects, FarRule, QNode, QuestionMap } from "./types";

export interface Vocabulary { topics: Record<string, string[]>; genres: string[] }

const SIDES = [["A", "a"], ["B", "b"]] as const;
const setsScope = (e: Effects) => Boolean(e.entry || e.topics || e.keywords || e.genres);
const setsMood = (e: Effects) => Boolean(e.axes || e.len !== undefined || e.way);

function tagErrors(where: string, e: Effects, vocab: Vocabulary, topicsSoFar: string[] | null): string[] {
  const out: string[] = [];
  for (const t of e.topics ?? []) if (!vocab.topics[t]) out.push(`${where} topic "${t}" is not one of ours`);
  for (const g of e.genres ?? []) if (!vocab.genres.includes(g)) out.push(`${where} genre "${g}" is not one of ours`);
  const topics = e.topics ?? topicsSoFar ?? Object.keys(vocab.topics);
  for (const k of e.keywords ?? []) {
    if (!topics.some((t) => vocab.topics[t]?.includes(k))) out.push(`${where} keyword "${k}" is not in ${topics.join("·")}`);
  }
  return out;
}

/** Rule i covers rule j when every scope j matches, i matches too — then j never wins (walk.ts: the first match wins). */
function covers(i: FarRule["from"], j: FarRule["from"]): boolean {
  const within = (wide?: string[] | null, narrow?: string[] | null) => !wide || (narrow != null && narrow.every((v) => wide.includes(v)));
  return (!i.entry || i.entry === j.entry) && within(i.topics, j.topics) && within(i.keywords, j.keywords) && within(i.genres, j.genres);
}

export function validateMap(map: QuestionMap, vocab: Vocabulary): string[] {
  const errors: string[] = [];
  const nodes = map.nodes;
  const exists = (id: string) => id === "draw" || Boolean(nodes[id]);

  for (const n of Object.values(nodes)) {
    for (const [name, key] of SIDES) {
      const c: Choice = n[key];
      if (!exists(c.next)) errors.push(`${n.id}: ${name} goes to unknown node "${c.next}"`);
      if (n.kind === "mood" && setsScope(c.effects)) errors.push(`${n.id}: ${name} is a mood question but changes the scope`);
      if (n.kind === "mood" && c.effects.mode) errors.push(`${n.id}: ${name} is a mood question but switches the mode`);
      if (n.kind === "narrow" && setsMood(c.effects)) errors.push(`${n.id}: ${name} is a narrow question but sets a mood`);
    }
    if (!exists(n.unsureNext)) errors.push(`${n.id}: unsure goes to unknown node "${n.unsureNext}"`);
  }

  // walk every route from the start: reachability, loops, and tags checked against the topics chosen on the way
  const reached = new Set<string>();
  const seenState = new Set<string>();
  const walk = (id: string, onPath: string[], topics: string[] | null) => {
    if (id === "draw" || !nodes[id]) return;
    if (onPath.includes(id)) {
      errors.push(`loop: ${[...onPath, id].join(" → ")}`);
      return;
    }
    const state = `${id}|${topics?.join(",") ?? "*"}`;
    if (seenState.has(state)) return;
    seenState.add(state);
    reached.add(id);
    const n: QNode = nodes[id];
    for (const [name, key] of SIDES) {
      const c = n[key];
      errors.push(...tagErrors(`${n.id}: ${name}`, c.effects, vocab, topics));
      walk(c.next, [...onPath, id], c.effects.topics ?? topics);
    }
    walk(n.unsureNext, [...onPath, id], topics);
  };
  walk(map.start, [], null);
  for (const id of Object.keys(nodes)) if (!reached.has(id)) errors.push(`${id}: not reachable from the start`);

  map.far.forEach((r, j) => {
    errors.push(...tagErrors(`far ${j + 1} from:`, r.from as Effects, vocab, null), ...tagErrors(`far ${j + 1} to:`, r.to as Effects, vocab, null));
    const i = map.far.findIndex((earlier, k) => k < j && covers(earlier.from, r.from));
    if (i >= 0) errors.push(`far ${j + 1} is shadowed by far ${i + 1}`);
  });
  return [...new Set(errors)];
}
