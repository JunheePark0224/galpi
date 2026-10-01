import { describe, expect, it } from "vitest";
import real from "@/data/books.json";
import sample from "@/data/books.sample.json";
import vocab from "@/data/vocab.json";
import { classifySchema, classifySystemPrompt } from "@/lib/goal/classify";
import { matchGoal } from "@/lib/goal/match";
import { MIN_ACTIVE_TOPIC_BOOKS, activeTopics } from "./active";
import { ACTIVE_VOCAB } from "./catalog";
import { normalizeCatalog } from "./normalize";
import { TOPIC_CHIPS, TOPICS } from "./taxonomy";
import type { CatalogBook, Vocab } from "./types";

const asRows = (books: CatalogBook[]) => books.map((b) => ({ ...b, slot: b.entry === "leaf" ? b.genre : b.topic }));

describe("app book data", () => {
  it.each([["books.sample.json", sample], ["books.json", real]])("%s passes the import checks unchanged", (_, data) => {
    const books = data as unknown as CatalogBook[];
    const bib = new Map(books.map((b) => [b.isbn, { title: b.title, author: b.author }]));
    expect(normalizeCatalog(asRows(books), bib)).toEqual(books);
  });

  it("sample has 12 🍃 and 18 🎯 books, enough for one full 🎯 draw in 데이터 분석", () => {
    const books = sample as unknown as CatalogBook[];
    expect(books.filter((b) => b.entry === "leaf")).toHaveLength(12);
    const target = books.filter((b) => b.entry === "target");
    expect(target).toHaveLength(18);
    expect(target.filter((b) => b.topic === "데이터 분석")).toHaveLength(5);
    expect(target.filter((b) => b.keywords.includes("SQL"))).toHaveLength(2);
  });

  it("activates exactly the topics with 10+ books in books.json — the classifier sees only those", () => {
    const books = real as unknown as CatalogBook[];
    const count = (t: string) => books.filter((b) => b.entry === "target" && b.topic === t).length;
    const active = activeTopics(books);
    expect(Object.keys(ACTIVE_VOCAB)).toEqual(active);
    const enumTopics = (classifySchema(ACTIVE_VOCAB) as { properties: { topic: { enum: string[] } } }).properties.topic.enum;
    expect(enumTopics).toEqual(active);
    const prompt = classifySystemPrompt(ACTIVE_VOCAB);
    for (const t of TOPICS) {
      expect(count(t) >= MIN_ACTIVE_TOPIC_BOOKS).toBe(active.includes(t));
      expect(prompt.includes(`- ${t}`)).toBe(active.includes(t));
    }
  });

  it("shows a chip only for an active topic (S-02 keeps its six until D-D)", () => {
    const active = activeTopics(real as unknown as CatalogBook[]);
    expect(TOPIC_CHIPS.map((c) => c.topic).filter((t) => !active.includes(t))).toEqual([]);
  });

  it("vocab.json covers all twelve topics: the 19 keywords of v1.1 left after 마음·회복 moved out, and the 33 D-A drafts (target-chips 2-1)", () => {
    expect(Object.keys(vocab)).toEqual([...TOPICS]);
    const count = (topics: readonly string[]) =>
      topics.reduce((n, t) => n + Object.keys((vocab as Vocab)[t].keywords).length, 0);
    expect(count(TOPICS.slice(0, 6))).toBe(19);
    expect(count(TOPICS.slice(6))).toBe(33);
    expect(Object.keys(vocab["돈 관리·투자"].keywords)).toEqual(["재테크 기초", "주식", "ETF·펀드", "부동산·청약", "연금·노후", "돈의 심리"]);
  });

  it.each([
    ["주식 공부", "돈 관리·투자", ["주식"]], ["ETF 적립식", "돈 관리·투자", ["ETF·펀드"]], ["청약 당첨", "돈 관리·투자", ["부동산·청약"]],
    ["환율이 왜 오르나", "경제 상식", ["금리·환율"]], ["넛지", "경제 상식", ["행동경제학"]],
    ["자존감 높이기", "마음 돌보기", ["자존감"]], ["우울할 때", "마음 돌보기", ["우울"]],
    ["말투 고치기", "대화·관계", ["말투·대화법"]], ["협상 잘하는 법", "대화·관계", ["설득·협상"]],
    ["면접 준비", "취업·커리어", ["자소서·면접"]], ["퇴사 고민", "취업·커리어", ["이직·퇴사"]],
    ["문해력 키우기", "글쓰기", ["문해력·어휘"]], ["카피라이팅", "글쓰기", ["카피라이팅"]],
  ])("a D-A draft pattern catches %s → %s %j (once its topic is on)", (note, topic, keywords) => {
    expect(matchGoal(note, vocab as Vocab)).toMatchObject({ topic, keywords, matched: true });
  });

  it("keeps 마음·회복 in 습관·집중 only until 마음 돌보기 turns on (its 5 books are re-tagged in D-C)", () => {
    const active = activeTopics(real as unknown as CatalogBook[]);
    const stillThere = Object.hasOwn(vocab["습관·집중"].keywords, "마음·회복");
    expect(active.includes("마음 돌보기") && stillThere).toBe(false);
  });
});
