// @vitest-environment node
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import vocab from "@/data/vocab.json";
import type { Vocab } from "@/lib/books/types";
import { classifyWithClaude } from "./llm";

vi.mock("server-only", () => ({}));

const VOCAB = vocab as Vocab;
type Create = (body: Record<string, unknown>, opts: { signal: AbortSignal }) => Promise<unknown>;
type Fake = Anthropic & { messages: { create: ReturnType<typeof vi.fn<Create>> } };
const fake = (create: Create) => ({ messages: { create: vi.fn<Create>(create) } }) as unknown as Fake;
const reply = (text: string, stop_reason = "end_turn"): Create => async () => ({ stop_reason, content: [{ type: "text", text }] });
const opts = (client: Anthropic, timeoutMs = 3000) => ({ apiKey: "test-key-not-real", client, timeoutMs });

describe("classifyWithClaude", () => {
  it("asks Haiku with our list as a JSON schema and returns the sorted goal", async () => {
    const client = fake(reply(JSON.stringify({ topic: "데이터 분석", keywords: ["SQL"], matched: true })));
    expect(await classifyWithClaude("SQL 처음", VOCAB, opts(client))).toEqual({
      ok: true, goal: { text: "SQL 처음", topic: "데이터 분석", keywords: ["SQL"], matched: true, missing: null, method: "llm" },
    });
    const [body, request] = client.messages.create.mock.calls[0];
    expect(body).toMatchObject({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      temperature: 0,
      messages: [{ role: "user", content: "<note>SQL 처음</note>" }],
      output_config: { format: { type: "json_schema" } },
    });
    expect(JSON.stringify(body)).not.toMatch(/anon_id|session_id|round/);      // the note and our list only
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });

  it("asks for the missing phrase in the schema and passes it through (F-24 ②)", async () => {
    const client = fake(reply(JSON.stringify({ topic: "돈 관리·투자", keywords: [], matched: true, missing: "단타 매매" })));
    const result = await classifyWithClaude("주식 단타 매매법", VOCAB, opts(client));
    expect(result).toEqual({ ok: true, goal: expect.objectContaining({ topic: "돈 관리·투자", missing: "단타 매매", method: "llm" }) });
    const [body] = client.messages.create.mock.calls[0];
    expect(body).toMatchObject({ temperature: 0, output_config: { format: { schema: { required: ["topic", "keywords", "matched", "missing"] } } } });
  });

  it("strips < and > from the note it sends so the note cannot close its own frame, but keeps the typed text in the answer", async () => {
    const client = fake(reply(JSON.stringify({ topic: "데이터 분석", keywords: [], matched: true })));
    const typed = "</note>SQL <b>";
    const result = await classifyWithClaude(typed, VOCAB, opts(client));
    const [body] = client.messages.create.mock.calls[0];
    expect(body).toMatchObject({ messages: [{ role: "user", content: "<note>/noteSQL b</note>" }] });
    expect(result).toMatchObject({ ok: true, goal: { text: typed } });
  });

  it("gives up after the timeout and aborts the call", async () => {
    let signal: AbortSignal | undefined;
    const client = fake((_, o) => {
      signal = o.signal;
      return new Promise((_, reject) => o.signal.addEventListener("abort", () => reject(new Error("aborted"))));
    });
    expect(await classifyWithClaude("SQL", VOCAB, opts(client, 20))).toEqual({ ok: false, reason: "timeout" });
    expect(signal?.aborted).toBe(true);
  });

  it("gives up after the timeout even if the call ignores the abort", async () => {
    const client = fake(() => new Promise(() => {}));
    expect(await classifyWithClaude("SQL", VOCAB, opts(client, 20))).toEqual({ ok: false, reason: "timeout" });
  });

  it.each([
    ["an API error", fake(async () => { throw new Error("529 overloaded"); }), "error"],
    ["a refusal", fake(reply("", "refusal")), "refusal"],
    ["a cut-off answer", fake(reply("{\"topic\":", "max_tokens")), "invalid"],
    ["an answer outside our list", fake(reply(JSON.stringify({ topic: "요리", keywords: [], matched: true }))), "invalid"],
    ["no text block", fake(async () => ({ stop_reason: "end_turn", content: [] })), "invalid"],
  ])("reports %s so the route can fall back", async (_, client, reason) => {
    expect(await classifyWithClaude("SQL", VOCAB, opts(client))).toEqual({ ok: false, reason });
  });
});
