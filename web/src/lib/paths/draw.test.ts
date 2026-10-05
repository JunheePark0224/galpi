import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mulberry32, type Book, type LeafBook, type TargetBook } from "@/lib/recommend";
import { distinctAuthors, drawForPath, levelsUp, maxPossible, moodScore } from "./draw";
import { parseQuestionMap } from "./parse";
import { ALL_SCOPE, NEUTRAL_MOOD, type Answer } from "./types";
import { walkPath } from "./walk";

const MINI = readFileSync(path.join(process.cwd(), "src/lib/paths/__fixtures__/mini-map.md"), "utf8");
const MAP = parseQuestionMap(MINI);
/** + the v2 list rules: 2 이야기 · 장르 없음 → 에세이·한국 소설·시, 3 배우기 · 주제 없음 → 인문·과학 교양·역사 (pick: one). */
const LISTS = parseQuestionMap(`${MINI}\n${readFileSync(path.join(process.cwd(), "src/lib/paths/__fixtures__/list-rules.md"), "utf8")}`);
const a = (node: string, choice: Answer["choice"]): Answer => ({ node, choice });
const SQL = [a("start", "A"), a("branch", "B"), a("learn-area", "A"), a("learn-data", "A"), a("mood-way", "B"), a("mood-len", "A")];

const t = (id: string, keywords: string[], way: TargetBook["way"] = "실습", pages = 200, topic = "데이터 분석"): TargetBook =>
  ({ id, entry: "target", field: "데이터·통계", topic, genre: topic, pages, way, keywords });
const l = (id: string, genre: string): LeafBook => ({ id, entry: "leaf", genre, pages: 250, axes: { temp: 1, pull: 0, gain: 0, world: 0 } });

const BOOKS: Book[] = [
  t("sql1", ["SQL"]), t("sql2", ["SQL"]), t("sql3", ["SQL"], "개념"), t("sql4", ["SQL"], "실습", 450), t("sql5", ["SQL"]),
  t("xl1", ["엑셀"]), t("xl2", ["엑셀"]), t("mind1", ["우울"], "개념", 200, "마음 돌보기"),
  l("e1", "인문"), l("e2", "인문"), l("e3", "인문"), l("e4", "인문"), l("e5", "인문"),
];
const opts = (seed = 1, seen: string[] = []) => ({ seen: new Set(seen), rng: mulberry32(seed) });

describe("moodScore", () => {
  it("scores a 🎯 book by way and length, a 🍃 book by the axes and length", () => {
    expect(moodScore(t("x", [], "실습", 200), { ...NEUTRAL_MOOD, ways: ["실습"], len: 1 })).toBe(4);   // way 2 + thin 2
    expect(moodScore(l("y", "에세이"), { ...NEUTRAL_MOOD, axes: { temp: 1, pull: 0, gain: 0, world: 0 }, len: 0 })).toBe(1);
    expect(moodScore(t("z", []), NEUTRAL_MOOD)).toBe(0);
  });
  it("counts length -1 for both entries and no way as nothing", () => {
    expect(moodScore(t("x", [], "실습", 450), { ...NEUTRAL_MOOD, ways: [], len: -1 })).toBe(1);          // thick welcome 1
    expect(moodScore(l("y", "에세이"), { ...NEUTRAL_MOOD, len: -1 })).toBe(-1);                             // 250p is thin
  });
  it("gives the way points to a book of any of the ways chosen (실제로 써먹는 쪽 = 실습 or 사례)", () => {
    const either = { ...NEUTRAL_MOOD, ways: ["실습", "사례"] as const };
    expect([moodScore(t("a", [], "실습", 320), either), moodScore(t("b", [], "사례", 320), either), moodScore(t("c", [], "개념", 320), either)]).toEqual([2, 2, 0]);
    expect(maxPossible("target", either)).toBe(2);
  });
});

describe("maxPossible", () => {
  const mood = { axes: { temp: 1, pull: -1, gain: 0, world: 0 }, len: -1 as const, ways: ["실습"] as const };
  it("follows the pool's entry: 🍃 axes + length, 🎯 way + length points, both → the larger", () => {
    expect(maxPossible("leaf", mood)).toBe(3);
    expect(maxPossible("target", mood)).toBe(3);                                       // way 2 + thick 1
    expect(maxPossible("target", { ...mood, ways: [], len: 1 })).toBe(2);             // thin 2
    expect(maxPossible("target", { ...mood, len: 0 })).toBe(2);
    expect(maxPossible(null, { ...mood, len: 1 })).toBe(4);                             // 🎯 2 + 2 beats 🍃 1 + 1 + 1
    expect(maxPossible(null, { ...mood, ways: [] })).toBe(3);                          // 🍃 3 beats 🎯 1
  });
});

describe("drawForPath", () => {
  it("SQL path: four SQL books recommended, the 운명 1장 from 데이터 분석 (one level up)", () => {
    const d = drawForPath(BOOKS, MAP, walkPath(MAP, SQL), opts());
    const rec = d.picks.filter((p) => p.kind === "recommended").map((p) => p.book.id);
    const fate = d.picks.filter((p) => p.kind === "random").map((p) => p.book);
    expect(rec).toHaveLength(4);
    expect(rec.every((id) => id.startsWith("sql"))).toBe(true);
    expect(fate).toHaveLength(1);
    expect(fate[0].entry === "target" && fate[0].topic).toBe("데이터 분석");
    expect(rec).not.toContain(fate[0].id);
    expect(d.scopeCount).toBe(5);
    expect(d.widenedScope).toBe(false);
  });

  it("too few in the scope: widens to the level above and says so", () => {
    const d = drawForPath(BOOKS, MAP, walkPath(MAP, SQL), opts(1, ["sql1", "sql2"]));
    expect(d.widenedScope).toBe(true);
    expect(d.picks.filter((p) => p.kind === "recommended")).toHaveLength(4);
    expect(d.scopeCount).toBe(3);
  });

  it("widened: every book the person narrowed to stays, the 운명 1장 comes from the level above, scores stay mood scores", () => {
    const w = walkPath(MAP, SQL);
    for (let seed = 1; seed <= 50; seed++) {
      const d = drawForPath(BOOKS, MAP, w, opts(seed, ["sql1", "sql2"]));
      const rec = d.picks.filter((p) => p.kind === "recommended").map((p) => p.book.id);
      expect(rec).toHaveLength(4);
      expect(rec).toEqual(expect.arrayContaining(["sql3", "sql4", "sql5"]));   // sql4 is thick: a weak mood match, kept anyway
      const fate = d.picks.filter((p) => p.kind === "random").map((p) => p.book);
      expect(fate).toHaveLength(1);
      expect(fate[0].entry === "target" && fate[0].topic).toBe("데이터 분석");
      expect(d.picks.every((p) => p.score === moodScore(p.book, w.mood))).toBe(true);
      expect(d.exhausted).toBe(false);                                              // mean 2.75 of best 4
    }
  });

  it("widened from a genre: all of that genre stays even past the broad genre cap", () => {
    const books: Book[] = [
      l("s1", "SF·판타지"), l("s2", "SF·판타지"), l("s3", "SF·판타지"),
      ...["e1", "e2", "e3", "e4", "e5", "e6"].map((id) => l(id, "에세이")), l("k1", "한국 소설"), l("k2", "한국 소설"),
    ];
    const SF = [a("start", "A"), a("branch", "A"), a("story-world", "B"), a("mood-temp", "B"), a("mood-len", "B")];
    for (let seed = 1; seed <= 50; seed++) {
      const d = drawForPath(books, MAP, walkPath(MAP, SF), opts(seed));
      expect(d.widenedScope).toBe(true);
      expect(d.picks.filter((p) => p.kind === "recommended").map((p) => p.book.id)).toEqual(expect.arrayContaining(["s1", "s2", "s3"]));
    }
  });

  it("the level above is thin too: widens once more to the whole entry, closer levels first", () => {
    const sparse: Book[] = [
      t("sql1", ["SQL"], "개념", 450), t("xl1", ["엑셀"], "개념", 450),
      ...["m1", "m2", "m3", "m4"].map((id) => t(id, ["우울"], "실습", 200, "마음 돌보기")),
      l("e1", "에세이"), l("e2", "에세이"),
    ];
    for (let seed = 1; seed <= 50; seed++) {
      const d = drawForPath(sparse, MAP, walkPath(MAP, SQL), opts(seed));
      const rec = d.picks.filter((p) => p.kind === "recommended").map((p) => p.book);
      expect(d.widenedScope).toBe(true);
      expect(d.scopeCount).toBe(1);
      expect(rec).toHaveLength(4);
      expect(rec.map((b) => b.id)).toEqual(expect.arrayContaining(["sql1", "xl1"]));   // weak mood matches, but closest
      expect(rec.every((b) => b.entry === "target")).toBe(true);                       // the whole 🎯 entry, not the library
      const fate = d.picks.filter((p) => p.kind === "random");
      expect(fate).toHaveLength(1);
      expect(fate[0].book.entry).toBe("target");
      expect(d.exhausted).toBe(true);                                               // two weak matches: mean 1.5 of best 4
    }
  });

  it("widened and still short: exhausted; with no mood asked, never short of a good match", () => {
    const tiny: Book[] = [t("sql1", ["SQL"]), t("xl1", ["엑셀"])];
    expect(drawForPath(tiny, MAP, walkPath(MAP, SQL), opts()).exhausted).toBe(true);
    const plain = [a("start", "A"), a("branch", "B"), a("learn-area", "A"), a("learn-data", "A"), a("mood-way", "unsure"), a("mood-len", "unsure")];
    const d = drawForPath(BOOKS, MAP, walkPath(MAP, plain), opts(1, ["sql1", "sql2"]));
    expect(d.widenedScope).toBe(true);
    expect(d.exhausted).toBe(false);
  });

  it("challenge: a 데이터 분석 answer draws from the far side (인문), keeping the mood", () => {
    const d = drawForPath(BOOKS, MAP, walkPath(MAP, [a("start", "B"), ...SQL.slice(1)]), opts());
    const rec = d.picks.filter((p) => p.kind === "recommended");
    expect(rec).toHaveLength(4);
    expect(rec.every((p) => p.book.entry === "leaf" && p.book.genre === "인문")).toBe(true);
    expect(d.picks.filter((p) => p.kind === "random")).toHaveLength(1);
  });

  it("challenge to the other entry: judged by what that entry can score, not exhausted for crossing", () => {
    const d = drawForPath(BOOKS, MAP, walkPath(MAP, [a("start", "B"), ...SQL.slice(1)]), opts());   // way 실습 + thin, far side 🍃
    expect(d.drawnFrom.mood.axes.world).toBe(1);                                                     // 실습 leans 현실 there
    expect(d.picks.filter((p) => p.kind === "recommended").every((p) => p.score === 1)).toBe(true);  // thin 1, these books are world 0
    expect(d.exhausted).toBe(false);
  });

  it("broad 🍃 scope keeps the genre cap: never more than 2 recommended of one genre", () => {
    const wide: Book[] = [
      ...["a1", "a2", "a3", "a4", "a5", "a6"].map((id) => l(id, "에세이")),
      l("b1", "한국 소설"), l("b2", "한국 소설"), l("c1", "외국 소설"), l("c2", "외국 소설"), l("d1", "SF·판타지"),
    ];
    const LEAF = [a("start", "A"), a("branch", "A"), a("story-world", "unsure"), a("mood-temp", "A"), a("mood-len", "A")];
    for (let seed = 1; seed <= 30; seed++) {
      const d = drawForPath(wide, MAP, walkPath(MAP, LEAF), opts(seed));
      const rec = d.picks.filter((p) => p.kind === "recommended");
      expect(rec).toHaveLength(4);
      const counts = new Map<string, number>();
      for (const p of rec) counts.set(p.book.genre, (counts.get(p.book.genre) ?? 0) + 1);
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
    }
  });

  it("whole library (no entry chosen) keeps the genre cap too", () => {
    const wide: Book[] = [
      ...["a1", "a2", "a3", "a4", "a5"].map((id) => l(id, "에세이")), l("b1", "한국 소설"), l("c1", "외국 소설"),
      t("x1", ["SQL"]), t("x2", ["SQL"]), t("x3", ["SQL"]),
    ];
    const ALL = [a("start", "A"), a("branch", "unsure"), a("mood-len", "A")];
    for (let seed = 1; seed <= 30; seed++) {
      const rec = drawForPath(wide, MAP, walkPath(MAP, ALL), opts(seed)).picks.filter((p) => p.kind === "recommended");
      const counts = new Map<string, number>();
      for (const p of rec) counts.set(p.book.genre, (counts.get(p.book.genre) ?? 0) + 1);
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
    }
  });

  it("a narrowed 🎯 scope has no genre cap: four books of one topic", () => {
    const d = drawForPath(BOOKS, MAP, walkPath(MAP, SQL), opts(3));
    expect(new Set(d.picks.filter((p) => p.kind === "recommended").map((p) => p.book.genre))).toEqual(new Set(["데이터 분석"]));
  });

  it("is reproducible with the same seed", () => {
    const one = drawForPath(BOOKS, MAP, walkPath(MAP, SQL), opts(7)).picks.map((p) => p.book.id);
    const two = drawForPath(BOOKS, MAP, walkPath(MAP, SQL), opts(7)).picks.map((p) => p.book.id);
    expect(one).toEqual(two);
  });

  it("refuses to draw before the path ends", () => {
    expect(() => drawForPath(BOOKS, MAP, walkPath(MAP, SQL.slice(0, 2)), opts())).toThrow(/not finished/);
  });
});

describe("drawForPath — 10-05 rules (design 5절)", () => {
  const MIXED = [a("start", "A"), a("branch", "unsure"), a("mood-len", "unsure")];
  const STORY = [a("start", "A"), a("branch", "A"), a("story-world", "unsure"), a("mood-temp", "unsure"), a("mood-len", "unsure")];
  const by = (b: Book, ...authors: string[]): Book => ({ ...b, authors });
  const rec = (d: ReturnType<typeof drawForPath>) => d.picks.filter((p) => p.kind === "recommended").map((p) => p.book);
  const fate = (d: ReturnType<typeof drawForPath>) => d.picks.find((p) => p.kind === "random")?.book;

  it("levelsUp: the person's scope, then each level narrowed through, up to the branch — the whole library only with no branch", () => {
    const sql = walkPath(MAP, SQL);
    expect(levelsUp(sql).map((s) => s.keywords ?? s.topics ?? s.entry)).toEqual([["SQL"], ["데이터 분석"], "target"]);
    expect(levelsUp(walkPath(MAP, MIXED))).toEqual([ALL_SCOPE]);
  });

  it("widens one level at a time: an empty keyword draws its topic, not the whole branch", () => {
    const books: Book[] = [...["d1", "d2", "d3", "d4", "d5"].map((id) => t(id, ["엑셀"])), ...["m1", "m2", "m3", "m4", "m5"].map((id) => t(id, ["우울"], "실습", 200, "마음 돌보기"))];
    for (let seed = 1; seed <= 30; seed++) {
      const d = drawForPath(books, MAP, walkPath(MAP, SQL), opts(seed));
      expect(d.scopeCount).toBe(0);
      expect(d.widenedScope).toBe(true);
      expect(rec(d).every((b) => b.entry === "target" && b.topic === "데이터 분석")).toBe(true);
      const f = fate(d);
      expect(f?.entry === "target" && f.topic).toBe("데이터 분석");   // the 운명 1장: the level the four came from
    }
  });

  it("one book per author: never two of one author, and a scope short of authors widens like a short scope", () => {
    const books: Book[] = [
      by(t("s1", ["SQL"]), "강성욱"), by(t("s2", ["SQL"]), "강성욱"), by(t("s3", ["SQL"]), "오세종"), by(t("s4", ["SQL"]), "최준선"),
      by(t("x1", ["엑셀"]), "권현욱"), by(t("x2", ["엑셀"]), "에이블런"),
    ];
    expect(distinctAuthors(books.slice(0, 4))).toBe(3);
    for (let seed = 1; seed <= 30; seed++) {
      const d = drawForPath(books, MAP, walkPath(MAP, SQL), opts(seed));
      const names = d.picks.flatMap((p) => p.book.authors ?? []);
      expect(new Set(names).size).toBe(names.length);
      expect(d.widenedScope).toBe(true);
      expect(rec(d)).toHaveLength(4);
      expect(rec(d).filter((b) => b.entry === "target" && b.keywords.includes("SQL"))).toHaveLength(3);   // all three SQL authors first
    }
  });

  it("섞어서: two 이야기 and two 배우기 books, the 운명 1장 from either", () => {
    const books: Book[] = [
      ...["e1", "e2", "e3"].map((id) => l(id, "에세이")), ...["k1", "k2"].map((id) => l(id, "한국 소설")),
      ...["x1", "x2", "x3", "x4", "x5", "x6"].map((id, i) => t(id, [], "실습", 200, ["데이터 분석", "통계", "AI 활용"][i % 3])),
    ];
    const entries = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const d = drawForPath(books, MAP, walkPath(MAP, MIXED), opts(seed));
      expect(rec(d).filter((b) => b.entry === "leaf")).toHaveLength(2);
      expect(rec(d).filter((b) => b.entry === "target")).toHaveLength(2);
      entries.add(fate(d)!.entry);
    }
    expect(entries).toEqual(new Set(["leaf", "target"]));
  });

  it("the 운명 1장 stays in the branch chosen: a story path with no genre never gets a 배우기 book", () => {
    const books: Book[] = [...["e1", "e2", "e3"].map((id) => l(id, "에세이")), l("k1", "한국 소설"), l("k2", "외국 소설"), ...BOOKS.filter((b) => b.entry === "target")];
    for (let seed = 1; seed <= 40; seed++) {
      expect(drawForPath(books, MAP, walkPath(MAP, STORY), opts(seed)).picks.every((p) => p.book.entry === "leaf")).toBe(true);
    }
  });

  it("도전 from 배우기: the way answer scores on the far side's story axes", () => {
    const essay = (id: string, axes: LeafBook["axes"]): LeafBook => ({ id, entry: "leaf", genre: "인문", pages: 320, axes });
    const books: Book[] = [
      ...BOOKS.filter((b) => b.entry === "target"),
      essay("know1", { temp: 0, pull: 0, gain: 1, world: 0 }), essay("know2", { temp: 0, pull: 0, gain: 1, world: 0 }),
      essay("real1", { temp: 0, pull: 0, gain: 0, world: 1 }), essay("real2", { temp: 0, pull: 0, gain: 0, world: 1 }),
      essay("n1", { temp: 0, pull: 0, gain: 0, world: 0 }), essay("n2", { temp: 0, pull: 0, gain: 0, world: 0 }),
    ];
    const route = (way: "A" | "B") => [a("start", "B"), a("branch", "B"), a("learn-area", "A"), a("learn-data", "A"), a("mood-way", way), a("mood-len", "unsure")];
    const shown = (way: "A" | "B", prefix: string) => {
      let n = 0;
      for (let seed = 1; seed <= 200; seed++) n += rec(drawForPath(books, MAP, walkPath(MAP, route(way)), opts(seed))).filter((b) => b.id.startsWith(prefix)).length;
      return n / 200;
    };
    expect(shown("A", "know")).toBeGreaterThan(shown("B", "know") + 0.5);   // 개념 → 알게 됨 (gain +1)
    expect(shown("B", "real")).toBeGreaterThan(shown("A", "real") + 0.5);   // 실습 → 현실 (world +1)
  });
});

describe("drawForPath — round 2 (10-05)", () => {
  const MIXED = [a("start", "A"), a("branch", "unsure"), a("mood-len", "unsure")];

  it("섞어서: the 운명 1장 is 이야기 or 배우기 half and half, whatever the book counts", () => {
    const books: Book[] = [
      ...["e1", "e2", "e3"].map((id) => l(id, "에세이")), ...["k1", "k2"].map((id) => l(id, "한국 소설")),
      ...Array.from({ length: 30 }, (_, i) => t(`x${i}`, [], "실습", 200, ["데이터 분석", "통계", "AI 활용", "습관·집중", "글쓰기"][i % 5])),
    ];
    let leaf = 0;
    const N = 400;
    for (let seed = 1; seed <= N; seed++) {
      const fate = drawForPath(books, MAP, walkPath(MAP, MIXED), opts(seed)).picks.find((p) => p.kind === "random")!.book;
      if (fate.entry === "leaf") leaf += 1;
    }
    expect(Math.abs(leaf / N - 0.5)).toBeLessThan(0.08);   // by book count it would be 1 leaf book left of 29 (≈ 3%)
  });

  it("섞어서 with only one entry's books left: the 운명 1장 comes from that one", () => {
    const books: Book[] = ["a1", "a2", "a3", "a4", "a5", "a6"].map((id, i) => l(id, ["에세이", "시", "인문"][i % 3]));
    for (let seed = 1; seed <= 20; seed++) {
      expect(drawForPath(books, MAP, walkPath(MAP, MIXED), opts(seed)).picks.find((p) => p.kind === "random")?.book.entry).toBe("leaf");
    }
  });
});

describe("drawForPath — challenge rules v2 (10-05)", () => {
  /** 🍃 인문 5 · 과학 교양 5 · 역사 4 · 에세이 5 · 한국 소설 6 · 시 2 · SF 6, and the 🎯 books. */
  const many = (genre: string, n: number) => Array.from({ length: n }, (_, i) => l(`${genre}${i}`, genre));
  const books: Book[] = [
    ...many("인문", 5), ...many("과학 교양", 5), ...many("역사", 4), ...many("에세이", 5), ...many("한국 소설", 6), ...many("시", 2), ...many("SF·판타지", 6),
    ...BOOKS.filter((b) => b.entry === "target"),
  ];
  const LEARN_NONE = [a("start", "B"), a("branch", "B"), a("learn-area", "unsure"), a("mood-way", "unsure"), a("mood-len", "unsure")];
  const STORY_NONE = [a("start", "B"), a("branch", "A"), a("story-world", "unsure"), a("mood-temp", "unsure"), a("mood-len", "unsure")];
  const MIXED_CHALLENGE = [a("start", "B"), a("branch", "unsure"), a("mood-len", "unsure")];

  it("배우기 · 주제 없음: one list genre with 5+ books per seed, the four from it, every book (운명 1장 too) a learning genre", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const d = drawForPath(books, LISTS, walkPath(LISTS, LEARN_NONE), opts(seed));
      const [genre] = d.drawnFrom.scope.genres!;
      expect(["인문", "과학 교양"]).toContain(genre);
      expect(d.picks.filter((p) => p.kind === "recommended").every((p) => p.book.genre === genre)).toBe(true);
      expect(d.picks.every((p) => p.book.entry === "leaf" && ["인문", "과학 교양", "역사"].includes(p.book.genre))).toBe(true);
      expect(d.drawnFrom.challenge).toMatchObject({ from: ["배우기 · 주제 없음"], to: [genre], rule: { n: 3 } });
      expect(drawForPath(books, LISTS, walkPath(LISTS, LEARN_NONE), opts(seed)).picks).toEqual(d.picks);   // same seed, same draw
      seen.add(genre);
    }
    expect(seen).toEqual(new Set(["인문", "과학 교양"]));
  });

  it("a 배우기 challenge widens inside the learning genres only, never to 이야기 as a whole", () => {
    const thin: Book[] = [...many("인문", 2), ...many("과학 교양", 3), ...many("에세이", 9), ...many("SF·판타지", 9), ...BOOKS.filter((b) => b.entry === "target")];
    const route = [a("start", "B"), ...SQL.slice(1)];                                                  // rule 1: 데이터 분석 → 인문
    for (let seed = 1; seed <= 30; seed++) {
      const d = drawForPath(thin, MAP, walkPath(MAP, route), opts(seed));
      expect(d.widenedScope).toBe(true);
      expect(d.picks.every((p) => ["인문", "과학 교양"].includes(p.book.genre))).toBe(true);
    }
  });

  it("이야기 · 장르 없음: one story genre of the list with 5+ books, only 이야기 books, never the other branch", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const d = drawForPath(books, LISTS, walkPath(LISTS, STORY_NONE), opts(seed));
      seen.add(d.drawnFrom.scope.genres![0]);
      expect(d.picks.every((p) => p.book.entry === "leaf")).toBe(true);
      expect(d.drawnFrom.challenge).toMatchObject({ from: ["이야기 · 장르 없음"], rule: { n: 2, title: "이야기 · 장르 없음 → 목록" }, reasonDraft: null });
    }
    expect(seen).toEqual(new Set(["에세이", "한국 소설"]));
  });

  it("no far rule (SF chosen, no SF rule in this map): the person's own scope — no fallback to the other branch", () => {
    const route = [a("start", "B"), a("branch", "A"), a("story-world", "B"), a("mood-temp", "unsure"), a("mood-len", "unsure")];
    for (let seed = 1; seed <= 20; seed++) {
      const d = drawForPath(books, MAP, walkPath(MAP, route), opts(seed));
      expect(d.drawnFrom.scope.genres).toEqual(["SF·판타지"]);
      expect(d.drawnFrom.challenge).toBeUndefined();
      expect(d.picks.every((p) => p.book.entry === "leaf")).toBe(true);
    }
  });

  it("도전 + 섞어서: a branch by the seed, then its list rule — reproducible, never the 🎯 books", () => {
    const rules = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const d = drawForPath(books, LISTS, walkPath(LISTS, MIXED_CHALLENGE), opts(seed));
      const c = d.drawnFrom.challenge!;
      expect(c.from).toEqual(["섞어서"]);
      expect(c.rule.n === 2 ? ["에세이", "한국 소설"] : ["인문", "과학 교양"]).toEqual(expect.arrayContaining(c.to));
      expect(d.picks.every((p) => p.book.entry === "leaf")).toBe(true);
      expect(drawForPath(books, LISTS, walkPath(LISTS, MIXED_CHALLENGE), opts(seed)).picks).toEqual(d.picks);
      rules.add(c.rule.n);
    }
    expect(rules).toEqual(new Set([2, 3]));
  });
});
