import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseQuestionMap } from "./parse";
import { ALL_SCOPE, type Answer } from "./types";
import { LEAF_GENRES } from "@/lib/books/taxonomy";
import { mulberry32 } from "@/lib/recommend";
import { applyChallenge, PathError, skipKey, walkPath, WAY_AXIS } from "./walk";

const MINI = readFileSync(path.join(process.cwd(), "src/lib/paths/__fixtures__/mini-map.md"), "utf8");
const MAP = parseQuestionMap(MINI);
const FAR_SF = "```far\nfrom: entry=target\nto: entry=leaf | genres=SF·판타지\n```\n";
const a = (node: string, choice: Answer["choice"]): Answer => ({ node, choice });
const SQL = [a("start", "A"), a("branch", "B"), a("learn-area", "A"), a("learn-data", "A"), a("mood-way", "B"), a("mood-len", "A")];

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

  it("challenge: swaps the scope for the far scope and keeps the mood", () => {
    const w = walkPath(MAP, [a("start", "B"), ...SQL.slice(1)]);
    expect(w.mode).toBe("challenge");
    const far = applyChallenge(MAP, w);
    expect(far.scope).toEqual({ entry: "leaf", topics: null, keywords: null, genres: ["에세이"] });
    expect(far.levels).toEqual([ALL_SCOPE, { ...ALL_SCOPE, entry: "leaf" }, far.scope]);
    expect(far.mood.len).toBe(w.mood.len);
  });

  it("challenge from 배우기 to 이야기: each way chosen leans its story axis (개념 → 알게 됨, 실습 → 현실, 사례 → 몰입)", () => {
    expect(WAY_AXIS).toEqual({ 개념: ["gain", 1], 실습: ["world", 1], 사례: ["pull", -1] });
    const route = (way: "A" | "B") => [a("start", "B"), a("branch", "B"), a("learn-area", "A"), a("learn-data", "A"), a("mood-way", way), a("mood-len", "A")];
    expect(applyChallenge(MAP, walkPath(MAP, route("B"))).mood).toEqual({ axes: { temp: 0, pull: 0, gain: 0, world: 1 }, len: 1, ways: [] });
    expect(applyChallenge(MAP, walkPath(MAP, route("A"))).mood.axes).toEqual({ temp: 0, pull: 0, gain: 1, world: 0 });
    const both = { ...walkPath(MAP, route("A")), mood: { axes: { temp: 0, pull: 0, gain: 0, world: 0 }, len: 0 as const, ways: ["실습", "사례"] as const } };
    expect(applyChallenge(MAP, both).mood.axes).toEqual({ temp: 0, pull: -1, gain: 0, world: 1 });
  });

  it("challenge from 배우기 with no far rule: the 이야기 entry whole, one level under the library", () => {
    const w = walkPath(MAP, [a("start", "B"), a("branch", "B"), a("learn-area", "B"), a("mood-way", "unsure"), a("mood-len", "A")]);
    const far = applyChallenge(MAP, w);
    expect(far.scope).toEqual({ ...ALL_SCOPE, entry: "leaf" });
    expect(far.levels).toEqual([ALL_SCOPE, far.scope]);
  });

  it("challenge from 이야기 with no far rule never leaves 이야기: one other story genre at random by the seed (0-book genres too)", () => {
    const w = walkPath(MAP, [a("start", "B"), a("branch", "A"), a("story-world", "B"), a("mood-temp", "A"), a("mood-len", "A")]);
    expect(applyChallenge(MAP, w)).toBe(w);                                          // no rng (skip table, E-34): as walked
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const far = applyChallenge(MAP, w, mulberry32(seed));
      expect(far.scope.entry).toBe("leaf");
      expect(far.scope.genres).toHaveLength(1);
      expect(far.scope.genres).not.toContain("SF·판타지");                           // not the genre already chosen
      expect(far.levels).toEqual([ALL_SCOPE, { ...ALL_SCOPE, entry: "leaf" }, far.scope]);
      expect(far.mood).toBe(w.mood);
      expect(applyChallenge(MAP, w, mulberry32(seed)).scope).toEqual(far.scope);
      seen.add(far.scope.genres![0]);
    }
    expect([...seen].sort()).toEqual(LEAF_GENRES.filter((g) => g !== "SF·판타지").sort());
  });

  it("challenge from 이야기 that already named every story genre: any story genre", () => {
    const all = parseQuestionMap(MINI.replace("B: 딴 세상 | genres=SF·판타지", `B: 딴 세상 | genres=${LEAF_GENRES.join(",")}`));
    const w = walkPath(all, [a("start", "B"), a("branch", "A"), a("story-world", "B"), a("mood-temp", "A"), a("mood-len", "A")]);
    const far = applyChallenge(all, w, mulberry32(1));
    expect(LEAF_GENRES).toContain(far.scope.genres![0]);
  });

  it("challenge with the whole library (no entry chosen): no rng → the scope stays; the draw's rng → one side at random, by the seed", () => {
    const w = walkPath(MAP, [a("start", "B"), a("branch", "unsure"), a("mood-len", "A")]);
    expect(w.mode).toBe("challenge");
    expect(applyChallenge(MAP, w)).toBe(w);
    const sides = new Set<string | null>();
    for (let seed = 1; seed <= 20; seed++) {
      const far = applyChallenge(MAP, w, mulberry32(seed));
      expect(far.scope).toEqual({ ...ALL_SCOPE, entry: far.scope.entry });
      expect(far.levels).toEqual([ALL_SCOPE, far.scope]);
      expect(applyChallenge(MAP, w, mulberry32(seed)).scope).toEqual(far.scope);
      sides.add(far.scope.entry);
    }
    expect(sides).toEqual(new Set(["leaf", "target"]));
  });

  it("challenge: the first far rule that matches wins", () => {
    const route = [a("start", "B"), ...SQL.slice(1)];
    const after = parseQuestionMap(`${MINI}\n${FAR_SF}`);
    expect(applyChallenge(after, walkPath(after, route)).scope.genres).toEqual(["에세이"]);
    const before = parseQuestionMap(MINI.replace("```far", `${FAR_SF}\n\`\`\`far`));
    expect(applyChallenge(before, walkPath(before, route)).scope.genres).toEqual(["SF·판타지"]);
  });

  it("challenge: a rule naming another entry does not match", () => {
    const other = parseQuestionMap(MINI.replace("from: entry=target", "from: entry=leaf"));
    const w = walkPath(other, [a("start", "B"), ...SQL.slice(1)]);
    expect(applyChallenge(other, w).scope).toEqual({ ...ALL_SCOPE, entry: "leaf" });
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
