// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GoalMatch } from "@/lib/goal/match";
import { classifyWithClaude } from "@/lib/server/llm";
import { POST } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/llm", () => ({ classifyWithClaude: vi.fn() }));

const ORIGIN = "http://x";
const post = (body: unknown, headers: Record<string, string> = { origin: ORIGIN, "x-forwarded-for": "8.8.8.8" }) =>
  POST(new Request(`${ORIGIN}/api/goal/classify`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers }));
const LLM_GOAL: GoalMatch = { text: "번아웃", topic: "습관·집중", keywords: ["마음·회복"], matched: true, method: "llm" };

describe("POST /api/goal/classify", () => {
  beforeEach(() => vi.mocked(classifyWithClaude).mockReset());
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("answers with word matching when there is no key (local runs, E2E) — no LLM call", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await post({ text: "  SQL 공부  " });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], matched: true, method: "word" });
    expect(classifyWithClaude).not.toHaveBeenCalled();
  });

  it("answers with Claude's sorting when the key is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-real");
    vi.mocked(classifyWithClaude).mockResolvedValue({ ok: true, goal: LLM_GOAL });
    expect(await (await post({ text: "번아웃" })).json()).toEqual(LLM_GOAL);
    expect(vi.mocked(classifyWithClaude).mock.calls[0][0]).toBe("번아웃");
    expect(vi.mocked(classifyWithClaude).mock.calls[0][2]).toEqual({ apiKey: "test-key-not-real" });
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

  it("answers 429 after 20 a minute from one address", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const from = { origin: ORIGIN, "x-forwarded-for": "9.8.7.6" };
    for (let i = 0; i < 20; i++) expect((await post({ text: "SQL" }, from)).status).toBe(200);
    expect((await post({ text: "SQL" }, from)).status).toBe(429);
  });
});
