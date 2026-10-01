// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_VOCAB } from "@/lib/books/catalog";
import type { GoalMatch } from "@/lib/goal/match";
import { resetDailyBudgets } from "@/lib/server/guard";
import { classifyWithClaude } from "@/lib/server/llm";
import { POST } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/llm", () => ({ classifyWithClaude: vi.fn() }));

const ORIGIN = "http://x";
const post = (body: unknown, headers: Record<string, string> = { origin: ORIGIN, "x-forwarded-for": "8.8.8.8" }) =>
  POST(new Request(`${ORIGIN}/api/goal/classify`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers }));
const LLM_GOAL: GoalMatch = { text: "번아웃", topic: "습관·집중", keywords: ["마음·회복"], matched: true, missing: null, method: "llm" };

describe("POST /api/goal/classify", () => {
  beforeEach(() => {
    vi.mocked(classifyWithClaude).mockReset();
    resetDailyBudgets();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("answers with word matching when there is no key (local runs, E2E) — no LLM call", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await post({ text: "  SQL 공부  " });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], matched: true, missing: null, method: "word" });
    expect(classifyWithClaude).not.toHaveBeenCalled();
  });

  it("answers with Claude's sorting when the key is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-real");
    vi.mocked(classifyWithClaude).mockResolvedValue({ ok: true, goal: LLM_GOAL });
    expect(await (await post({ text: "번아웃" })).json()).toEqual(LLM_GOAL);
    expect(vi.mocked(classifyWithClaude).mock.calls[0][0]).toBe("번아웃");
    expect(vi.mocked(classifyWithClaude).mock.calls[0][2]).toEqual({ apiKey: "test-key-not-real" });
  });

  // Until the 10-01 pilot this asserted 주식 → nearest active topic (matched false): 돈 관리·투자 had 0 books. The pilot
  // added 15 books to each new topic, so all 12 are on; the off-topic case is covered with fixtures in active.test.ts.
  it("sorts into a new topic once it has 10+ books (주식 → 돈 관리·투자 after the 10-01 pilot)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const goal = (await (await post({ text: "주식 투자 입문" }, { origin: ORIGIN, "x-forwarded-for": "8.8.4.5" })).json()) as GoalMatch;
    expect(goal).toMatchObject({ topic: "돈 관리·투자", keywords: ["주식"], matched: true, missing: null, method: "word" });
    expect(Object.keys(ACTIVE_VOCAB)).toContain("돈 관리·투자");
  });

  it("gives Claude the active topics only (D-A: 10 books or more)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-real");
    vi.mocked(classifyWithClaude).mockResolvedValue({ ok: true, goal: LLM_GOAL });
    await post({ text: "번아웃" }, { origin: ORIGIN, "x-forwarded-for": "8.8.4.4" });
    expect(vi.mocked(classifyWithClaude).mock.calls[0][1]).toBe(ACTIVE_VOCAB);
  });

  it("falls back to word matching on a timeout and logs only the reason, never the note", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-real");
    vi.mocked(classifyWithClaude).mockResolvedValue({ ok: false, reason: "timeout" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await (await post({ text: "SQL 공부" })).json()).toMatchObject({ topic: "데이터 분석", method: "word" });
    expect(warn).toHaveBeenCalledWith("classify: fell back to word matching", "timeout");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("SQL");
  });

  it.each([
    ["no text", {}],
    ["blank text", { text: "   " }],
    ["31 characters", { text: "가".repeat(31) }],
    ["a number", { text: 3 }],
    ["null", "null"],
    ["not JSON", "{"],
  ])("refuses %s with 400", async (_, body) => {
    expect((await post(body)).status).toBe(400);
  });

  it("refuses another origin and a body over 1 KB", async () => {
    expect((await post({ text: "SQL" }, { origin: "https://evil.example", "x-forwarded-for": "8.8.8.9" })).status).toBe(403);
    expect((await post({ text: "SQL", pad: "x".repeat(1100) }, { origin: ORIGIN, "x-forwarded-for": "8.8.8.10" })).status).toBe(413);
  });

  it("answers 429 after 10 a minute from one address", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const from = { origin: ORIGIN, "x-forwarded-for": "9.8.7.6" };
    for (let i = 0; i < 10; i++) expect((await post({ text: "SQL" }, from)).status).toBe(200);
    expect((await post({ text: "SQL" }, from)).status).toBe(429);
  });

  describe("daily LLM budget (300 calls per instance per UTC day)", () => {
    const callMany = async (n: number) => {
      for (let i = 0; i < n; i++) {
        // a fresh address each time so the per-minute limit never gets in the way
        await post({ text: "번아웃" }, { origin: ORIGIN, "x-forwarded-for": `10.0.${Math.floor(i / 200)}.${i % 200}` });
      }
    };

    it("stops calling Claude after 300 calls and answers with word matching, logging only the reason", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-real");
      vi.useFakeTimers({ now: Date.parse("2026-10-01T10:00:00Z"), toFake: ["Date"] });
      vi.mocked(classifyWithClaude).mockResolvedValue({ ok: true, goal: LLM_GOAL });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      await callMany(300);
      expect(classifyWithClaude).toHaveBeenCalledTimes(300);

      const res = await post({ text: "SQL 공부" }, { origin: ORIGIN, "x-forwarded-for": "11.1.1.1" });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ topic: "데이터 분석", method: "word" });
      expect(classifyWithClaude).toHaveBeenCalledTimes(300);
      expect(warn).toHaveBeenCalledWith("classify: fell back to word matching", "budget");
      expect(JSON.stringify(warn.mock.calls)).not.toContain("SQL");
    });

    it("starts a fresh budget when the UTC date changes", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-real");
      vi.useFakeTimers({ now: Date.parse("2026-10-01T23:59:00Z"), toFake: ["Date"] });
      vi.mocked(classifyWithClaude).mockResolvedValue({ ok: true, goal: LLM_GOAL });
      vi.spyOn(console, "warn").mockImplementation(() => {});
      await callMany(300);
      await post({ text: "번아웃" }, { origin: ORIGIN, "x-forwarded-for": "11.1.1.2" });
      expect(classifyWithClaude).toHaveBeenCalledTimes(300);

      vi.setSystemTime(Date.parse("2026-10-02T00:00:01Z"));
      expect(await (await post({ text: "번아웃" }, { origin: ORIGIN, "x-forwarded-for": "11.1.1.3" })).json()).toEqual(LLM_GOAL);
      expect(classifyWithClaude).toHaveBeenCalledTimes(301);
    });

    it("does not spend budget when there is no key", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "");
      await callMany(5);
      vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-real");
      vi.mocked(classifyWithClaude).mockResolvedValue({ ok: true, goal: LLM_GOAL });
      await callMany(300);
      expect(classifyWithClaude).toHaveBeenCalledTimes(300);
    });
  });
});
