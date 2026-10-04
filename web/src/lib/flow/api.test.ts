// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PathDrawResponse } from "@/lib/books/types";
import { SQL_PATH } from "@/lib/paths/__fixtures__/paths";
import { drawBody, requestDraw, toDrawView } from "./api";
import { INITIAL } from "./state";

const card = (id: string) => ({ id, entry: "leaf" as const, title: id, author: "시인", genre: "시", field: null, oneLiner: "?", oneLinerStyle: "question" as const });
const RES: PathDrawResponse = {
  picks: ["a", "b", "c", "d", "e"].map((id, i) => ({
    card: card(id), kind: i === 0 ? "random" : "recommended", reason: { label: "나온 이유", items: [`이유 ${id}`] },
  })),
  exhausted: false, widened: false, path: { crumbs: ["이야기에 빠지기"], moods: [], mode: "challenge" },
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
