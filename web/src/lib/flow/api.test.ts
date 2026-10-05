// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PathDrawResponse } from "@/lib/books/types";
import { SQL_PATH } from "@/lib/paths/__fixtures__/paths";
import { artsForDraw } from "@/lib/art/combine";
import { drawBody, requestDraw, toDrawView } from "./api";
import { INITIAL } from "./state";

const card = (id: string) => ({ id, entry: "leaf" as const, title: id, author: "시인", genre: "시", field: null, oneLiner: "?", oneLinerStyle: "question" as const });
const RES: PathDrawResponse = {
  picks: ["a", "b", "c", "d", "e"].map((id, i) => ({
    card: card(id), kind: i === 0 ? "random" : "recommended", reason: { label: "나온 이유", items: [`이유 ${id}`] },
  })),
  exhausted: false, widened: false, path: { crumbs: ["이야기에 빠지기"], moods: [], mode: "challenge" },
  challenge: { from: ["이야기 · 장르 없음"], to: ["시"], rule: { n: 19, title: "이야기 · 장르 없음 → 도전 목록" }, reasonDraft: null },
};

describe("flow api", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the answers and the books this session has shown", () => {
    expect(drawBody({ ...INITIAL, answers: SQL_PATH, seen: ["x"] })).toEqual({ answers: SQL_PATH, seen: ["x"] });
  });

  it("gives every pick its own animal, keeps the order and the path for S-04", () => {
    const view = toDrawView(RES, 9);
    expect(view.picks.map((p) => p.card.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(view.picks.map((p) => p.kind)).toEqual(["random", "recommended", "recommended", "recommended", "recommended"]);
    expect(new Set(view.picks.map((p) => p.art.animal)).size).toBe(5);
    expect(view.picks[1].reason).toEqual({ label: "나온 이유", items: ["이유 b"] });
    expect(view.path).toEqual(RES.path);
  });

  it("keeps the challenge provenance for the result screen (10-05 v2), null when there is none", () => {
    expect(toDrawView(RES, 9).challenge).toEqual(RES.challenge);
    expect(toDrawView({ ...RES, challenge: null }, 9).challenge).toBeNull();
    const older = { ...RES, challenge: undefined } as unknown as PathDrawResponse;           // an answer from before v2
    expect(toDrawView(older, 9).challenge).toBeNull();
  });

  it("draws the pictures from the server's signed seed and keeps the ticket for the 도감 (v1)", () => {
    const art = { seed: 4242, count: 5, iat: 100, sub: null, sig: "s".repeat(43) };
    const view = toDrawView({ ...RES, art }, 9);
    expect(view.picks.map((p) => p.art)).toEqual(artsForDraw(5, 4242));
    expect(view.ticket).toEqual(art);
    expect(toDrawView({ ...RES, art: { ...art, sig: null } }, 9).ticket).toBeNull();          // unsigned: shown, not recorded
    expect(toDrawView({ ...RES, art: { ...art, count: 4 } }, 9).picks.map((p) => p.art)).toEqual(artsForDraw(5, 9));
    expect(toDrawView(RES, 9).ticket).toBeNull();
  });

  it("posts JSON to /api/books/draw", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(RES));
    vi.stubGlobal("fetch", fetchMock);
    expect(await requestDraw({ answers: [] })).toEqual(RES);
    expect(fetchMock).toHaveBeenCalledWith("/api/books/draw", expect.objectContaining({ method: "POST", body: "{\"answers\":[]}" }));
  });

  it("throws on a failed request so the page can offer a retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 400 })));
    await expect(requestDraw({})).rejects.toThrow(/400/);
  });
});
