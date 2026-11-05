// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryStore } from "@/lib/library/__fixtures__/memoryStore";
import type { LibraryStore } from "@/lib/library/types";

vi.mock("server-only", () => ({}));
const MAKER = "a6a1fd0c-ba1b-431c-92c8-c6578a72a152";
let client: object | null = {};
let store: LibraryStore;
const opened: string[] = [];
vi.mock("@/lib/server/serviceClient", () => ({ serviceClient: () => client }));
vi.mock("@/lib/library/supabaseStore", () => ({
  supabaseStore: (_db: unknown, userId: string) => {
    opened.push(userId);
    return store;
  },
}));
vi.mock("@/lib/books/catalog", () => ({
  catalog: () => [{ isbn: "9788936477196", title: "선량한 차별주의자" }],
  toCard: (b: { isbn: string; title: string }) => ({ id: b.isbn, title: b.title }),
}));
const error = vi.spyOn(console, "error").mockImplementation(() => {});

import { clearMakerCache } from "@/lib/server/makerShelf";
import { GET } from "./route";

const ORIGIN = "http://x";
let ip = 0;
const get = (headers: Record<string, string> = { origin: ORIGIN }) =>
  GET(new Request(`${ORIGIN}/api/maker-shelf`, { headers: { "x-forwarded-for": `10.1.0.${ip++ % 250}`, ...headers } }));
const ART = { animal: "rabbit", bg: "aurora", ground: "grass", rare: true } as const;
const filled = () => memoryStore({
  shelves: [{ id: "s0", name: "첫 막대", position: 0 }],
  saves: [
    { isbn: "9788936477196", art: ART, reason: { label: "이 책은", items: ["따뜻함"] }, metOn: "2026-10-17", shelfId: "s0", position: -1, originalArt: ART },
    { isbn: "9780000000000", art: ART, reason: { label: "이 책은", items: [] }, metOn: "2026-10-18", shelfId: "s0", position: 0, originalArt: ART },
  ],
});

describe("GET /api/maker-shelf (F-30)", () => {
  beforeEach(() => {
    clearMakerCache();
    client = {};
    store = filled();
    opened.length = 0;
    vi.stubEnv("MAKER_USER_ID", MAKER);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    error.mockClear();
  });

  it("reads the maker's account only and returns the public view, books outside the catalogue left out", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=60");
    expect(await res.json()).toEqual({
      shelves: [{ name: "첫 막대", bookmarks: [{ art: ART, metOn: "2026-10-17", card: { id: "9788936477196", title: "선량한 차별주의자" } }] }],
      count: 1,
    });
    expect(opened).toEqual([MAKER]);
  });

  it("keeps the answer for a minute: a second visitor does not read the database again", async () => {
    await get();
    await get();
    expect(opened).toHaveLength(1);
  });

  it("is an empty shelf, not an error, with no maker set, a malformed id or no service key", async () => {
    for (const setup of [
      () => vi.stubEnv("MAKER_USER_ID", ""),
      () => vi.stubEnv("MAKER_USER_ID", "not-a-uuid"),
      () => { client = null; },
    ]) {
      clearMakerCache();
      setup();
      const res = await get();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ shelves: [], count: 0 });
    }
    expect(opened).toEqual([]);
  });

  it("warns once (no values) when a production deploy has no maker set", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MAKER_USER_ID", "");
    await get();
    clearMakerCache();
    await get();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).not.toContain(MAKER);
    warn.mockRestore();
  });

  it("answers 503 when the database fails, logs no rows, and tries again on the next request", async () => {
    store = { ...filled(), saves: async () => { throw new Error("library saves failed: 08006"); } };
    const res = await get();
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    store = filled();
    expect((await get()).status).toBe(200);
  });

  it("refuses another site (same-origin guard)", async () => {
    const res = await get({ origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(opened).toEqual([]);
  });
});
