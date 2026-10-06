import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mulberry32, type Book, type LeafBook } from "@/lib/recommend";
import { LEARN_CHALLENGE_GENRES, NO_CHOICE_LABEL } from "./challenge";
import { parseQuestionMap } from "./parse";
import { ALL_SCOPE, type Answer } from "./types";
import { applyChallenge, PathError, skipKey, walkPath, WAY_AXIS } from "./walk";

const MINI = readFileSync(path.join(process.cwd(), "src/lib/paths/__fixtures__/mini-map.md"), "utf8");
const MAP = parseQuestionMap(MINI);
const FAR_SF = "```far\nfrom: entry=target\nto: entry=leaf | genres=과학 교양\n```\n";
/** The mini map with the two list rules of v2 (19 이야기 · 장르 없음, 36 배우기 · 주제 없음) as rules 2 and 3. */
const LISTS = parseQuestionMap(`${MINI}\n${readFileSync(path.join(process.cwd(), "src/lib/paths/__fixtures__/list-rules.md"), "utf8")}`);
const leaf = (genre: string, n: number): LeafBook[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${genre}${i}`, entry: "leaf", genre, pages: 250, axes: { temp: 0, pull: 0, gain: 0, world: 0 } }));
/** 🍃 인문 5 · 과학 교양 6 · 역사 4 · 에세이 5 · 한국 소설 7 · 시 2, and 🎯 books whose genre reads 역사 (they never count for the 🍃 genre). */
const BOOKS: Book[] = [
  ...leaf("인문", 5), ...leaf("과학 교양", 6), ...leaf("역사", 4), ...leaf("에세이", 5), ...leaf("한국 소설", 7), ...leaf("시", 2),
  ...Array.from({ length: 3 }, (_, i): Book => ({ id: `t${i}`, entry: "target", field: "f", topic: "역사", genre: "역사", pages: 200, way: "개념", keywords: [] })),
];
const draw = (seed: number) => ({ rng: mulberry32(seed), books: BOOKS });
const a = (node: string, choice: Answer["choice"]): Answer => ({ node, choice });
const SQL = [a("start", "A"), a("branch", "B"), a("learn-area", "A"), a("learn-data", "A"), a("mood-way", "B"), a("mood-len", "A")];
const LEARN_NONE = [a("start", "B"), a("branch", "B"), a("learn-area", "unsure"), a("mood-way", "unsure"), a("mood-len", "A")];

describe("walkPath", () => {
  it("starts at the start with the whole scope", () => {
    expect(walkPath(MAP, [])).toMatchObject({ next: "start", scope: ALL_SCOPE, levels: [ALL_SCOPE], mode: "normal", crumbs: [], depth: 0, unsure: 0, skipped: [] });
  });

  it("follows the SQL path: narrows to the keyword, keeps every level narrowed through, the mood is set, the path ends", () => {
    const w = walkPath(MAP, SQL);
    expect(w.next).toBeNull();
    expect(w.scope).toEqual({ entry: "target", topics: ["데이터 분석"], keywords: ["SQL"], genres: null });
    expect(w.levels).toEqual([
      ALL_SCOPE, { ...ALL_SCOPE, entry: "target" }, { ...ALL_SCOPE, entry: "target", topics: ["데이터 분석"] }, w.scope,
    ]);
    expect(w.mood).toEqual({ axes: { temp: 0, pull: 0, gain: 0, world: 0 }, len: 1, ways: ["실습"] });
    expect(w.crumbs).toEqual(["뭔가 배우기", "데이터를 다루기", "DB에서 꺼내기"]);
    expect(w.depth).toBe(6);
  });

  it("stops narrowing on 'unsure' and counts it; going back is just one answer fewer", () => {
    const w = walkPath(MAP, [a("start", "A"), a("branch", "B"), a("learn-area", "unsure")]);
    expect(w.next).toBe("mood-way");
    expect(w.scope).toEqual({ ...ALL_SCOPE, entry: "target" });
    expect(w.levels).toEqual([ALL_SCOPE, w.scope]);
    expect(w.unsure).toBe(1);
    expect(w.crumbs).toEqual(["뭔가 배우기"]);
    expect(walkPath(MAP, SQL.slice(0, 3)).next).toBe("learn-data");
  });

  it("refuses an answer for a question that was not asked", () => {
    expect(() => walkPath(MAP, [a("branch", "A")])).toThrow(PathError);
    expect(() => walkPath(MAP, [...SQL, a("mood-len", "A")])).toThrow(/after the end/);
  });

  it("challenge: swaps the scope for the far scope, keeps the mood, and records where from and where to", () => {
    const w = walkPath(MAP, [a("start", "B"), ...SQL.slice(1)]);
    expect(w.mode).toBe("challenge");
    const far = applyChallenge(MAP, w);
    expect(far.scope).toEqual({ entry: "leaf", topics: null, keywords: null, genres: ["인문"] });
    // a 배우기 challenge widens only inside the learning genres, never to the whole 이야기 side
    expect(far.levels).toEqual([ALL_SCOPE, { ...ALL_SCOPE, entry: "leaf", genres: [...LEARN_CHALLENGE_GENRES] }, far.scope]);
    expect(far.mood.len).toBe(w.mood.len);
    expect(far.challenge).toEqual({ from: ["데이터 분석"], to: ["인문"], rule: { n: 1, title: "데이터 분석 → 인문" }, reason: "숫자에서 사람으로" });
    expect(applyChallenge(MAP, walkPath(MAP, SQL))).toEqual(walkPath(MAP, SQL));                // not a challenge: as walked, no record
    expect(walkPath(MAP, SQL).challenge).toBeUndefined();
  });

  it("challenge from 배우기 to 이야기: each way chosen leans its story axis (개념 → 알게 됨, 실습 → 현실, 사례 → 몰입)", () => {
    expect(WAY_AXIS).toEqual({ 개념: ["gain", 1], 실습: ["world", 1], 사례: ["pull", -1] });
    const route = (way: "A" | "B") => [a("start", "B"), a("branch", "B"), a("learn-area", "A"), a("learn-data", "A"), a("mood-way", way), a("mood-len", "A")];
    expect(applyChallenge(MAP, walkPath(MAP, route("B"))).mood).toEqual({ axes: { temp: 0, pull: 0, gain: 0, world: 1 }, len: 1, ways: [] });
    expect(applyChallenge(MAP, walkPath(MAP, route("A"))).mood.axes).toEqual({ temp: 0, pull: 0, gain: 1, world: 0 });
    const both = { ...walkPath(MAP, route("A")), mood: { axes: { temp: 0, pull: 0, gain: 0, world: 0 }, len: 0 as const, ways: ["실습", "사례"] as const } };
    expect(applyChallenge(MAP, both).mood.axes).toEqual({ temp: 0, pull: -1, gain: 0, world: 1 });
  });

  it("challenge with no matching far rule: the walk as it was — never the other branch (v2: no fallback)", () => {
    const learn = walkPath(MAP, [a("start", "B"), a("branch", "B"), a("learn-area", "B"), a("mood-way", "unsure"), a("mood-len", "A")]);
    expect(applyChallenge(MAP, learn, draw(1))).toBe(learn);
    const story = walkPath(MAP, [a("start", "B"), a("branch", "A"), a("story-world", "B"), a("mood-temp", "A"), a("mood-len", "A")]);
    for (let seed = 1; seed <= 50; seed++) expect(applyChallenge(MAP, story, draw(seed))).toBe(story);
    const other = parseQuestionMap(MINI.replace("from: entry=target", "from: entry=leaf"));     // a rule naming another entry
    const w = walkPath(other, [a("start", "B"), ...SQL.slice(1)]);
    expect(applyChallenge(other, w, draw(1))).toBe(w);
  });

  it("list rule 36 (배우기 · 주제 없음): one genre with 5+ books, equal chance, by the seed — with provenance", () => {
    const w = walkPath(LISTS, LEARN_NONE);
    const whole = applyChallenge(LISTS, w);                                                    // no draw (skip table, E-34): the whole list
    expect(whole.scope.genres).toEqual(["인문", "과학 교양", "역사"]);
    expect(whole.levels).toEqual([ALL_SCOPE, { ...ALL_SCOPE, entry: "leaf", genres: [...LEARN_CHALLENGE_GENRES] }, whole.scope]);
    const count = new Map<string, number>();
    const N = 1000;
    for (let seed = 1; seed <= N; seed++) {
      const far = applyChallenge(LISTS, w, draw(seed));
      expect(far.scope.genres).toHaveLength(1);
      expect(applyChallenge(LISTS, w, draw(seed)).scope).toEqual(far.scope);                   // reproducible
      expect(far.challenge).toEqual({
        from: [NO_CHOICE_LABEL.target], to: far.scope.genres, rule: { n: 3, title: "배우기 · 주제 없음 → 목록" }, reason: "다른 분야로 한 발짝",
      });
      count.set(far.scope.genres![0], (count.get(far.scope.genres![0]) ?? 0) + 1);
    }
    expect([...count.keys()].sort()).toEqual(["과학 교양", "인문"]);                           // 역사 has 4 books: not a candidate
    expect(Math.abs(count.get("인문")! / N - 0.5)).toBeLessThan(0.05);
  });

  it("list rule 19 (이야기 · 장르 없음): a story genre of the list with 5+ books, no reason written", () => {
    const w = walkPath(LISTS, [a("start", "B"), a("branch", "A"), a("story-world", "unsure"), a("mood-temp", "A"), a("mood-len", "A")]);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const far = applyChallenge(LISTS, w, draw(seed));
      expect(far.levels).toEqual([ALL_SCOPE, { ...ALL_SCOPE, entry: "leaf" }, far.scope]);   // a story challenge widens inside 이야기
      expect(far.mood).toBe(w.mood);
      expect(far.challenge).toEqual({ from: [NO_CHOICE_LABEL.leaf], to: far.scope.genres, rule: { n: 2, title: "이야기 · 장르 없음 → 목록" }, reason: null });
      seen.add(far.scope.genres![0]);
    }
    expect([...seen].sort()).toEqual(["에세이", "한국 소설"]);                                 // 시 has 2 books
  });

  it("list rule: no genre of the list has 5 books → the whole list as one target", () => {
    const w = walkPath(LISTS, LEARN_NONE);
    const few = BOOKS.filter((b) => b.genre !== "인문" && b.genre !== "과학 교양");
    expect(applyChallenge(LISTS, w, { rng: mulberry32(1), books: few }).scope.genres).toEqual(["인문", "과학 교양", "역사"]);
  });

  it("challenge with the whole library (섞어서): no draw → as walked; with one → a branch by the seed, then that branch's list rule", () => {
    const w = walkPath(LISTS, [a("start", "B"), a("branch", "unsure"), a("mood-len", "A")]);
    expect(w.mode).toBe("challenge");
    expect(applyChallenge(LISTS, w)).toBe(w);
    const rules = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const far = applyChallenge(LISTS, w, draw(seed));
      expect(far.scope.entry).toBe("leaf");
      expect(far.challenge!.from).toEqual([NO_CHOICE_LABEL.mixed]);
      expect(far.challenge!.rule.n === 2 ? ["에세이", "한국 소설"] : ["인문", "과학 교양"]).toContain(far.scope.genres![0]);
      expect(applyChallenge(LISTS, w, draw(seed)).scope).toEqual(far.scope);
      rules.add(far.challenge!.rule.n);
    }
    expect(rules).toEqual(new Set([2, 3]));
  });

  it("challenge: the first far rule that matches wins", () => {
    const route = [a("start", "B"), ...SQL.slice(1)];
    const after = parseQuestionMap(`${MINI}\n${FAR_SF}`);
    expect(applyChallenge(after, walkPath(after, route)).scope.genres).toEqual(["인문"]);
    const before = parseQuestionMap(MINI.replace("1. 데이터 분석 → 인문\n\n```far", `${FAR_SF}\n\`\`\`far`));
    expect(applyChallenge(before, walkPath(before, route)).scope.genres).toEqual(["과학 교양"]);
  });

  it("unsure at the first question keeps the usual mode", () => {
    const w = walkPath(MAP, [a("start", "unsure"), a("branch", "A")]);
    expect(w.mode).toBe("normal");
    expect(w.crumbs).toEqual(["이야기에 빠지기"]);
  });

  it("leaves a normal path alone", () => {
    const w = walkPath(MAP, SQL);
    expect(applyChallenge(MAP, w)).toBe(w);
  });
});

describe("walkPath with map.skip (design 5-2: mood questions that cannot change the draw)", () => {
  const before = walkPath(MAP, SQL.slice(0, 4));                                    // standing before mood-way
  const skipWay = { ...MAP, skip: new Set([skipKey(before)]) };

  it("passes a listed mood question over as 'unsure': not asked, not counted, not in depth or unsure", () => {
    const w = walkPath(skipWay, SQL.slice(0, 4));
    expect(w.next).toBe("mood-len");
    expect(w.skipped).toEqual(["mood-way"]);
    expect(w).toMatchObject({ depth: 4, unsure: 0, mood: before.mood });
    expect(walkPath(skipWay, [...SQL.slice(0, 4), a("mood-len", "B")])).toMatchObject({ next: null, depth: 5, skipped: ["mood-way"] });
  });

  it("refuses an answer to a question it passed over; one answer fewer (back) lands on the question shown before", () => {
    expect(() => walkPath(skipWay, SQL)).toThrow(/expected an answer for "mood-len", got "mood-way"/);
    expect(walkPath(skipWay, SQL.slice(0, 3)).next).toBe("learn-data");
  });

  it("is keyed by the question, the route and the levels: the same question elsewhere is still asked", () => {
    expect(walkPath(skipWay, [a("start", "A"), a("branch", "B"), a("learn-area", "B")]).next).toBe("mood-way");
    expect(walkPath(skipWay, [a("start", "B"), ...SQL.slice(1, 4)]).next).toBe("mood-way");
    expect(skipKey(before)).toBe("mood-way|normal|all>entry=target>entry=target;topics=데이터 분석>entry=target;topics=데이터 분석;keywords=SQL");
  });

  it("passes over several in a row, up to the end of the path, and never a narrowing question", () => {
    const end = walkPath(MAP, SQL.slice(0, 5));
    const both = { ...MAP, skip: new Set([skipKey(before), skipKey(end), "learn-data|normal|all>entry=target>entry=target;topics=데이터 분석"]) };
    const w = walkPath(both, SQL.slice(0, 4));
    expect(w).toMatchObject({ next: null, skipped: ["mood-way", "mood-len"] });
    expect(walkPath(both, SQL.slice(0, 3)).next).toBe("learn-data");
  });
});
