import type { Book } from "@/lib/recommend";
import { inScope, scopeKey, type Answer, type QuestionMap } from "./types";
import { applyChallenge, walkPath } from "./walk";

export interface PathEnd { scopeKey: string; crumbs: string[]; mode: "normal" | "challenge"; books: number; example: Answer[] }

/** Every distinct place a path can end (scope × mode). Mood questions are passed with "unsure": they never move the scope. */
export function pathEnds(map: QuestionMap): Omit<PathEnd, "books">[] {
  const out = new Map<string, Omit<PathEnd, "books">>();
  const visit = (answers: Answer[]) => {
    const w = walkPath(map, answers);
    if (w.next === null) {
      const final = applyChallenge(map, w);
      const key = `${w.mode}|${scopeKey(final.scope)}`;
      if (!out.has(key)) out.set(key, { scopeKey: scopeKey(final.scope), crumbs: w.crumbs, mode: w.mode, example: answers });
      return;
    }
    const node = map.nodes[w.next];
    const choices: Answer["choice"][] = node.kind === "mood" ? ["unsure"] : ["A", "B", "unsure"];
    for (const choice of choices) visit([...answers, { node: node.id, choice }]);
  };
  visit([]);
  return [...out.values()];
}

export function coverage(map: QuestionMap, books: Book[]): PathEnd[] {
  return pathEnds(map)
    .map((end) => {
      const w = applyChallenge(map, walkPath(map, end.example));
      return { ...end, books: books.filter((b) => inScope(b, w.scope)).length };
    })
    .sort((x, y) => x.books - y.books || x.scopeKey.localeCompare(y.scopeKey));
}
