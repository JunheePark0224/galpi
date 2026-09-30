// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const NINE = ["A", "unsure", "B", "A", "A", "B", "B", "A", "A"];
const req = (body: unknown) =>
  new Request("http://x/api/books/draw", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

describe("POST /api/books/draw", () => {
  beforeEach(() => vi.stubEnv("BOOKS_SOURCE", "sample"));
  afterEach(() => vi.unstubAllEnvs());

  it("draws 🍃 books for nine balance answers", async () => {
    const res = await POST(req({ entry: "leaf", choices: NINE, seen: [], seed: 7 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.picks).toHaveLength(5);
    expect(body.found).toBeNull();
  });

  it("is reproducible for a seed", async () => {
    const a = await (await POST(req({ entry: "leaf", choices: NINE, seed: 11 }))).json();
    const b = await (await POST(req({ entry: "leaf", choices: NINE, seed: 11 }))).json();
    expect(a).toEqual(b);
  });

  it("draws 🎯 books with the coverage count", async () => {
    const res = await POST(req({ entry: "target", answers: { topic: "데이터 분석", way: null, len: 0, keywords: ["SQL"] }, seen: [], seed: 1 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ found: 2, keywords: ["SQL"] });
  });

  it("sends only what a bookmark shows — no scores, no tags", async () => {
    const body = await (await POST(req({ entry: "leaf", choices: NINE, seed: 3 }))).json();
    expect(Object.keys(body.picks[0]).sort()).toEqual(["card", "kind"]);
    expect(Object.keys(body.picks[0].card).sort()).toEqual(["entry", "field", "genre", "id", "oneLiner", "oneLinerStyle", "title"]);
  });

  it.each([
    ["not JSON", "{"],
    ["an unknown entry", { entry: "shelf" }],
    ["eight answers", { entry: "leaf", choices: NINE.slice(1) }],
    ["an unknown answer", { entry: "leaf", choices: [...NINE.slice(1), "C"] }],
    ["an unknown topic", { entry: "target", answers: { topic: "요리", way: null, len: 0, keywords: [] } }],
    ["an unknown way", { entry: "target", answers: { topic: "통계", way: "독학", len: 0, keywords: [] } }],
    ["a length outside -1..1", { entry: "target", answers: { topic: "통계", way: null, len: 2, keywords: [] } }],
    ["a keyword of another topic", { entry: "target", answers: { topic: "통계", way: null, len: 0, keywords: ["SQL"] } }],
    ["too many keywords", { entry: "target", answers: { topic: "AI 활용", way: null, len: 0, keywords: ["챗GPT", "클로드", "제미나이", "프롬프트 엔지니어링", "바이브 코딩", "AI 에이전트"] } }],
    ["seen that is not a list of ids", { entry: "leaf", choices: NINE, seen: "9790000000001" }],
    ["a seen id that is not a string", { entry: "leaf", choices: NINE, seen: [9790000000001] }],
    ["a negative seed", { entry: "leaf", choices: NINE, seed: -1 }],
    ["a body over the size cap", { entry: "leaf", choices: NINE, seen: Array.from({ length: 2500 }, (_, i) => `id-${i}-padding`) }],
  ])("rejects %s with 400", async (_, body) => {
    expect((await POST(req(body))).status).toBe(400);
  });
});
