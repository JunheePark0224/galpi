// @vitest-environment node
import { describe, expect, it } from "vitest";
import catalogueJson from "@/data/books.json";
import sample from "@/data/books.sample.json";
import { mulberry32 } from "@/lib/recommend";
import { applyChallenge, LEARN_CHALLENGE_GENRES, pathReason, QUESTION_MAP, walkPath, type Answer } from "@/lib/paths";
import { toBook } from "./catalog";
import { drawPath } from "./draw";
import { CHALLENGE_PATH, MIXED_PATH, SQL_PATH } from "@/lib/paths/__fixtures__/paths";
import type { CatalogBook } from "./types";

const BOOKS = sample as unknown as CatalogBook[];
const none = new Set<string>();

describe("drawPath (v2: the answers of the question map)", () => {
  const sql = BOOKS.filter((b) => b.keywords.includes("SQL")).map((b) => b.isbn);

  it("SQL path: five different books, one 운명, the SQL books first, and the path for S-04", () => {
    const res = drawPath(SQL_PATH, none, mulberry32(7), BOOKS);
    expect(res.picks).toHaveLength(5);
    expect(new Set(res.picks.map((p) => p.card.id)).size).toBe(5);
    expect(res.picks.filter((p) => p.kind === "random")).toHaveLength(1);
    expect(res.picks.every((p) => p.card.entry === "target")).toBe(true);
    expect(res.picks.filter((p) => sql.includes(p.card.id))).toHaveLength(2);
    expect(res.widened).toBe(true);
    expect(res.path).toEqual({
      crumbs: ["뭔가 배우기", "일을 더 잘하기", "숫자·도구 다루기", "데이터 읽고 분석", "데이터 꺼내는 도구", "DB에서 꺼내기"],
      moods: ["실제로 써먹는 쪽", "가볍게 읽히는 얇은 책"], mode: "normal",
    });
    const sqlPick = res.picks.find((p) => sql.includes(p.card.id) && p.kind === "recommended");
    expect(sqlPick?.reason).toMatchObject({ label: "나온 이유", items: expect.arrayContaining(["데이터 분석", "SQL"]) });
    expect(Object.keys(res.picks[0]).sort()).toEqual(["card", "kind", "reason"]);
  });

  it("challenge path: 🍃 books from the far side, the route kept for S-04", () => {
    const res = drawPath(CHALLENGE_PATH, none, mulberry32(3), BOOKS);
    expect(res.picks).toHaveLength(5);
    expect(res.picks.every((p) => p.card.entry === "leaf")).toBe(true);
    expect(res.path.mode).toBe("challenge");
  });

  it("challenge path: reasons come from the flipped scope (after applyChallenge), not the chosen side", () => {
    const res = drawPath(CHALLENGE_PATH, none, mulberry32(3), BOOKS);
    const walked = walkPath(QUESTION_MAP, CHALLENGE_PATH);
    const flipped = applyChallenge(QUESTION_MAP, walked);
    const byId = new Map(BOOKS.map((b) => [b.isbn, b]));
    for (const p of res.picks) {
      expect(p.reason).toEqual(pathReason(toBook(byId.get(p.card.id) as CatalogBook), flipped));
    }
    expect(flipped.scope).not.toEqual(walked.scope);
  });

  it("mixed path: any book of the library, never one already shown", () => {
    const seen = new Set(BOOKS.slice(0, 10).map((b) => b.isbn));
    const res = drawPath(MIXED_PATH, seen, mulberry32(5), BOOKS);
    expect(res.picks).toHaveLength(5);
    expect(res.picks.some((p) => seen.has(p.card.id))).toBe(false);
    expect(res.path).toEqual({ crumbs: [], moods: ["가볍게 얇은 책"], mode: "normal" });
  });
});

describe("drawPath — challenge provenance (rules v2, 10-05)", () => {
  /** A route through the real map: these answers, then "못 잡겠어요" to whatever is still asked. */
  const finish = (...steps: [string, Answer["choice"]][]): Answer[] => {
    const out: Answer[] = steps.map(([node, choice]) => ({ node, choice }));
    for (let w = walkPath(QUESTION_MAP, out); w.next !== null; w = walkPath(QUESTION_MAP, out)) out.push({ node: w.next, choice: "unsure" });
    return out;
  };
  const MONEY = finish(["start", "B"], ["branch", "B"], ["learn-intro", "A"], ["learn-area", "B"], ["learn-life", "B"], ["learn-daily-body", "B"], ["learn-daily", "B"], ["learn-money-field", "unsure"]);
  const LEARN_NONE = finish(["start", "B"], ["branch", "B"], ["learn-intro", "B"]);
  const STORY_NONE = finish(["start", "B"], ["branch", "A"], ["story-intro", "B"]);
  const catalogue = catalogueJson as unknown as CatalogBook[];   // today's catalogue: the 5-book threshold needs real counts
  /** A far rule by its number (10-05: numbers stay with their rules; 37-43 sit above older ones). */
  const rule = (n: number) => QUESTION_MAP.far.find((r) => r.n === n)!;

  it("a catalogue with no list genre of 5 books (the sample): the whole list as the target", () => {
    expect(drawPath(LEARN_NONE, none, mulberry32(11), BOOKS).challenge!.to).toEqual(rule(36).to.genres);
  });

  it("the usual route: challenge null", () => {
    expect(drawPath(SQL_PATH, none, mulberry32(7), catalogue).challenge).toBeNull();
  });

  it("rule 30: 돈·경제 → 인문·역사, its title and draft reason, the books from there", () => {
    const res = drawPath(MONEY, none, mulberry32(3), catalogue);
    expect(res.challenge).toEqual({
      from: ["돈 관리·투자", "경제 상식"], to: ["인문", "역사"], rule: { n: 30, title: "돈·경제 → 인문·역사" },
      reasonDraft: "값을 매기는 글에서 사람과 시간을 바라보는 글로",
    });
    expect(res.picks.every((p) => p.card.entry === "leaf" && LEARN_CHALLENGE_GENRES.includes(p.card.genre))).toBe(true);
  });

  it("rule 36: 배우기 · 주제 없음 → one list genre, the same one again for the same seed", () => {
    const res = drawPath(LEARN_NONE, none, mulberry32(11), catalogue);
    expect(res.challenge).toMatchObject({ from: ["배우기 · 주제 없음"], rule: { n: 36 }, reasonDraft: "이번에는 평소와 다른 분야에서 한 발짝 나아가 봤어요" });
    expect(res.challenge!.to).toHaveLength(1);
    expect(LEARN_CHALLENGE_GENRES).toContain(res.challenge!.to[0]);
    expect(drawPath(LEARN_NONE, none, mulberry32(11), catalogue).challenge).toEqual(res.challenge);
    expect(res.picks.filter((p) => p.kind === "recommended").every((p) => p.card.genre === res.challenge!.to[0])).toBe(true);
  });

  it("rule 19: 이야기 · 장르 없음 → one list genre, no reason written yet", () => {
    const res = drawPath(STORY_NONE, none, mulberry32(5), catalogue);
    expect(res.challenge).toMatchObject({ from: ["이야기 · 장르 없음"], rule: { n: 19 }, reasonDraft: null });
    expect(rule(19).to.genres).toContain(res.challenge!.to[0]);
    expect(res.picks.every((p) => p.card.entry === "leaf")).toBe(true);
  });

  it("10-05: rule 37 (로맨스) and the new topics' rules 38-43 win over the older group rules below them, by their own numbers", () => {
    const romance = finish(["start", "B"], ["branch", "A"], ["story-intro", "A"], ["story-shelf", "A"], ["story-fiction", "A"], ["story-real", "A"]);
    expect(drawPath(romance, none, mulberry32(3), catalogue).challenge).toMatchObject({
      from: ["로맨스"], to: ["SF·판타지", "역사"], rule: { n: 37 }, reasonDraft: "두 사람의 이야기에서 더 큰 세계와 시간으로",
    });
    const realNovel = finish(["start", "B"], ["branch", "A"], ["story-intro", "A"], ["story-shelf", "A"], ["story-fiction", "A"]);
    expect(drawPath(realNovel, none, mulberry32(3), catalogue).challenge).toMatchObject({ from: ["한국 소설", "외국 소설", "로맨스"], rule: { n: 17 } });
    const into: [string, Answer["choice"]][] = [["start", "B"], ["branch", "B"], ["learn-intro", "A"]];
    const brand = finish(...into, ["learn-area", "A"], ["learn-work", "B"], ["learn-craft-people", "B"], ["learn-reach", "A"], ["learn-market", "A"], ["learn-market-make", "A"]);
    expect(walkPath(QUESTION_MAP, brand).scope).toMatchObject({ topics: ["마케팅·브랜딩"], keywords: ["브랜딩"] });
    expect(drawPath(brand, none, mulberry32(3), catalogue).challenge).toMatchObject({ from: ["마케팅·브랜딩"], to: ["예술·여행", "인문"], rule: { n: 38 } });
    const reach = finish(...into, ["learn-area", "A"], ["learn-work", "B"], ["learn-craft-people", "B"]);
    expect(drawPath(reach, none, mulberry32(3), catalogue).challenge).toMatchObject({ to: ["인문", "역사"], rule: { n: 42, title: "함께 움직이기 → 인문·역사" } });
    const people = finish(...into, ["learn-area", "A"], ["learn-work", "B"]);
    expect(drawPath(people, none, mulberry32(3), catalogue).challenge).toMatchObject({ rule: { n: 31, title: "일하는 방식과 사람 전체 → 예술·여행·과학 교양" } });
    const body = finish(...into, ["learn-area", "B"], ["learn-life", "B"], ["learn-daily-body", "A"]);
    const res = drawPath(body, none, mulberry32(3), catalogue);
    expect(res.challenge).toMatchObject({ from: ["건강·운동", "요리·살림"], to: ["과학 교양", "예술·여행"], rule: { n: 43 } });
    expect(res.picks.every((p) => p.card.entry === "leaf" && LEARN_CHALLENGE_GENRES.includes(p.card.genre))).toBe(true);
    for (const [topicChoice, n] of [["A", 40], ["B", 41]] as const) {
      const one = finish(...into, ["learn-area", "B"], ["learn-life", "B"], ["learn-daily-body", "A"], ["learn-body", topicChoice]);
      expect(drawPath(one, none, mulberry32(3), catalogue).challenge!.rule.n).toBe(n);
    }
    const lead = finish(...into, ["learn-area", "A"], ["learn-work", "B"], ["learn-craft-people", "B"], ["learn-reach", "B"]);
    expect(drawPath(lead, none, mulberry32(3), catalogue).challenge).toMatchObject({ from: ["리더십"], to: ["역사", "인문"], rule: { n: 39 } });
  });

  it("rule 1 (SF chosen): the story rule's title, no reason", () => {
    expect(drawPath(CHALLENGE_PATH, none, mulberry32(3), catalogue).challenge).toEqual({
      from: ["SF·판타지"], to: ["에세이", "시"], rule: { n: 1, title: rule(1).title }, reasonDraft: null,
    });
  });
});
