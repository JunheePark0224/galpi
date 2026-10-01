// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import vocab from "@/data/vocab.json";
import type { DrawResponse, Vocab } from "@/lib/books/types";
import { activeVocab } from "@/lib/books/active";
import { classifyGoal, drawBody, goalFor, requestDraw, toDrawView } from "./api";
import { INITIAL } from "./state";

const card = (id: string) => ({ id, entry: "leaf" as const, title: id, author: "시인", genre: "시", field: null, oneLiner: "?", oneLinerStyle: "question" as const });
const RES: DrawResponse = {
  picks: ["a", "b", "c", "d", "e"].map((id, i) => ({
    card: card(id), kind: i === 0 ? "random" : "recommended", reason: { label: "나온 이유", items: [`이유 ${id}`] },
  })),
  exhausted: false, widened: false, found: null, keywords: [],
};

describe("flow api", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the answers and the books this session has shown (🍃)", () => {
    expect(drawBody({ ...INITIAL, entry: "leaf", choices: ["A", "B"], seen: ["x"] })).toEqual({ entry: "leaf", choices: ["A", "B"], seen: ["x"] });
  });

  it("sends scoring answers built from the form and the matched goal (🎯)", () => {
    const goal = { text: "SQL", topic: "데이터 분석" as const, keywords: ["SQL"], matched: true, missing: null, method: "word" as const };
    expect(drawBody({ ...INITIAL, entry: "target", form: { topic: null, free: "SQL", len: "thin", way: "실습" }, goal }))
      .toEqual({ entry: "target", answers: { topic: "데이터 분석", way: "실습", len: 1, keywords: ["SQL"] }, seen: [] });
  });

  it("gives every pick its own animal and keeps the order", () => {
    const view = toDrawView(RES, 9);
    expect(view.picks.map((p) => p.card.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(view.picks.map((p) => p.kind)).toEqual(["random", "recommended", "recommended", "recommended", "recommended"]);
    expect(new Set(view.picks.map((p) => p.art.animal)).size).toBe(5);
    expect(view.picks[1].reason).toEqual({ label: "나온 이유", items: ["이유 b"] });
  });

  it("posts JSON to /api/books/draw", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(RES));
    vi.stubGlobal("fetch", fetchMock);
    expect(await requestDraw({ entry: "leaf" })).toEqual(RES);
    expect(fetchMock).toHaveBeenCalledWith("/api/books/draw", expect.objectContaining({ method: "POST", body: "{\"entry\":\"leaf\"}" }));
  });

  it("throws on a failed request so the page can offer a retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 400 })));
    await expect(requestDraw({})).rejects.toThrow(/400/);
  });
});

describe("classifyGoal", () => {
  afterEach(() => vi.unstubAllGlobals());
  const VOCAB = vocab as Vocab;

  it("posts the trimmed note and takes the server's sorting (method llm)", async () => {
    const answer = { text: "번아웃", topic: "습관·집중", keywords: ["마음·회복"], matched: true, missing: null, method: "llm" };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(answer));
    vi.stubGlobal("fetch", fetchMock);
    expect(await classifyGoal("  번아웃  ", VOCAB)).toEqual(answer);
    expect(fetchMock).toHaveBeenCalledWith("/api/goal/classify", expect.objectContaining({ method: "POST", body: "{\"text\":\"번아웃\"}" }));
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("keeps the server's missing phrase (F-24), clipped again in the browser", async () => {
    const answer = { text: "주식 단타", topic: "돈 관리·투자", keywords: [], matched: true, missing: " 단타 매매 ", method: "llm" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(answer)));
    expect((await classifyGoal("주식 단타", VOCAB)).missing).toBe("단타 매매");
  });

  it.each([
    ["an older server that leaves it out", { method: "llm" }],
    ["a name of the matched topic", { method: "llm", missing: "돈 관리·투자" }],
    ["word matching (it never names a missing thing)", { method: "word", missing: "단타 매매" }],
  ])("reads missing as null for %s", async (_, extra) => {
    const answer = { text: "주식 단타", topic: "돈 관리·투자", keywords: [], matched: true, ...extra };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(answer)));
    expect((await classifyGoal("주식 단타", VOCAB)).missing).toBeNull();
  });

  it.each([
    ["a refused request", () => Promise.resolve(new Response("{}", { status: 429 }))],
    ["a failed request", () => Promise.reject(new TypeError("offline"))],
    ["an answer outside our list", () => Promise.resolve(Response.json({ topic: "요리", keywords: [], matched: true, missing: null, method: "llm" }))],
  ])("falls back to word matching in the browser on %s", async (_, answer) => {
    vi.stubGlobal("fetch", vi.fn(answer));
    expect(await classifyGoal("SQL 공부", VOCAB)).toEqual({ text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], matched: true, missing: null, method: "word" });
  });
});

describe("goalFor (S-02 🎯 B: example chip or written goal)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const VOCAB = vocab as Vocab;

  it("answers an untouched example chip from the fixed table without asking the server", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await goalFor(" 데이터 분석 ", VOCAB)).toEqual({ text: "데이터 분석", topic: "데이터 분석", keywords: [], matched: true, missing: null, method: "example" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sorts an edited example like any written goal", async () => {
    const answer = { text: "데이터 분석 입문", topic: "데이터 분석", keywords: [], matched: true, missing: null, method: "llm" };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(answer));
    vi.stubGlobal("fetch", fetchMock);
    expect(await goalFor("데이터 분석 입문", VOCAB)).toEqual(answer);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("sorts an example whose topic is not active (not in the vocab it was given)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const goal = await goalFor("돈 관리", activeVocab(VOCAB, ["데이터 분석", "AI 활용"]));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(goal.method).toBe("word");
  });
});
