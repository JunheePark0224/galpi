import { describe, expect, it } from "vitest";
import books from "@/data/books.json";
import { LEAF_GENRES, TOPICS } from "@/lib/books/taxonomy";
import { parseQuestionMap } from "./parse";
import { validateMap } from "./validate";
import { MAP_GENRES, mapVocabulary } from "./vocabulary";

const VOCAB = { "데이터 분석": { keywords: { SQL: "SQL", 엑셀: "엑셀" }, terms: ["R"] } };

describe("mapVocabulary", () => {
  it("takes topics and their keywords (not terms) from vocab.json", () => {
    expect(mapVocabulary(VOCAB).topics).toEqual({ "데이터 분석": ["SQL", "엑셀"] });
  });
  it("checks against every genre we define — all 12 🍃 genres and the 🎯 topics — not only the ones with books", () => {
    expect(MAP_GENRES).toEqual([...LEAF_GENRES, ...TOPICS]);
    expect(mapVocabulary(VOCAB).genres).toEqual(MAP_GENRES);
    expect((books as { genre: string }[]).some((b) => b.genre === "호러·괴담")).toBe(false);
  });
  it("lets a map name a genre with no books yet", () => {
    const map = parseQuestionMap("```node\nid: s\nkind: narrow\nquestion: q\nA: 괴담 | entry=leaf | genres=호러·괴담 | next=draw\nB: 역사 | entry=leaf | genres=역사 | next=draw\nunsure: next=draw\n```");
    expect(validateMap(map, mapVocabulary(VOCAB))).toEqual([]);
  });
});
