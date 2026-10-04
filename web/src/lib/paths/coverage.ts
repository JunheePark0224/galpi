import type { Book } from "@/lib/recommend";
import { inScope, scopeKey, type Answer, type AnswerChoice, type QNode, type QuestionMap, type Scope } from "./types";
import { applyChallenge, PathError, startWalk, takeAnswer, type Walked } from "./walk";

export interface PathEnd { scopeKey: string; crumbs: string[]; mode: "normal" | "challenge"; books: number; example: Answer[] }
type End = Omit<PathEnd, "books"> & { scope: Scope };

/** Mood questions never move the scope, so one choice per distinct next question is enough ("unsure" first). */
function choicesAt(n: QNode): AnswerChoice[] {
  if (n.kind === "narrow") return ["A", "B", "unsure"];
  const nextOf: Record<AnswerChoice, string> = { unsure: n.unsureNext, A: n.a.next, B: n.b.next };
  const all: AnswerChoice[] = ["unsure", "A", "B"];
  return all.filter((c, i) => all.findIndex((d) => nextOf[d] === nextOf[c]) === i);
}

/**
 * Every distinct place a path can end, keyed by (mode, final scope). One example route and its crumbs are kept per
 * key — the first one found; e.g. "SF only" reached by two routes is listed once. The walked state is carried along
 * (no re-walk from the start), and a state (next question, scope, mode) is expanded once: the ends below it depend on
 * nothing else. A question met twice on one route is a loop and stops the walk.
 */
function ends(map: QuestionMap): End[] {
  const out = new Map<string, End>();
  const expanded = new Set<string>();
  const visit = (w: Walked, answers: Answer[], onPath: string[]) => {
    if (w.next === null) {
      const { scope } = applyChallenge(map, w);
      const key = `${w.mode}|${scopeKey(scope)}`;
      if (!out.has(key)) out.set(key, { scopeKey: scopeKey(scope), crumbs: w.crumbs, mode: w.mode, example: answers, scope });
      return;
    }
    if (onPath.includes(w.next)) throw new PathError(`loop: ${[...onPath, w.next].join(" → ")}`);
    const state = `${w.next}|${scopeKey(w.scope)}|${w.mode}`;
    if (expanded.has(state)) return;
    expanded.add(state);
    const node = map.nodes[w.next];
    for (const choice of choicesAt(node)) {
      const ans: Answer = { node: node.id, choice };
      visit(takeAnswer(map, w, ans), [...answers, ans], [...onPath, node.id]);
    }
  };
  visit(startWalk(map), [], []);
  return [...out.values()];
}

export function pathEnds(map: QuestionMap): Omit<PathEnd, "books">[] {
  return ends(map).map(({ scopeKey: key, crumbs, mode, example }) => ({ scopeKey: key, crumbs, mode, example }));
}

export function coverage(map: QuestionMap, books: Book[]): PathEnd[] {
  return ends(map)
    .map(({ scope, ...end }) => ({ ...end, books: books.filter((b) => inScope(b, scope)).length }))
    .sort((x, y) => x.books - y.books || x.scopeKey.localeCompare(y.scopeKey));
}
