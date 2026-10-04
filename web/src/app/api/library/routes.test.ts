// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryStore } from "@/lib/library/__fixtures__/memoryStore";
import type { LibraryStore } from "@/lib/library/types";

vi.mock("server-only", () => ({}));
let configured = true;
let userId: string | null = "u1";
let store: ReturnType<typeof memoryStore>;
vi.mock("@/lib/auth/server", () => ({
  authClient: async () => (configured ? {} : null),
  sessionUserId: async () => userId,
}));
vi.mock("@/lib/library/supabaseStore", () => ({
  supabaseStore: () => store as LibraryStore,
  savedIsbns: async () => store.data.saves.map((s) => s.isbn),
}));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    has: (name: string) => jar.has(name),
    delete: (name: string) => jar.delete(name),
  }),
}));
vi.mock("@/lib/books/catalog", () => ({
  catalog: () => [{ isbn: "9788998441012", entry: "leaf", title: "모순", author: "양귀자", genre: "한국 소설", field: null, one_liner: "한 줄", one_liner_style: "question" }],
  toCard: (b: { isbn: string; title: string }) => ({ id: b.isbn, title: b.title }),
}));
const error = vi.spyOn(console, "error").mockImplementation(() => {});

import { GET as me } from "../me/route";
import { GET as library } from "./route";
import { DELETE as unsave, PATCH as move, POST as save } from "./saves/route";
import { DELETE as unsaveAll } from "./saves/all/route";
import { DELETE as removeShelf, PATCH as renameShelf, POST as addShelf } from "./shelves/route";

const ORIGIN = "http://x";
let ip = 0;
const headers = () => ({ origin: ORIGIN, "x-forwarded-for": `10.0.0.${ip++ % 250}` });
const get = (path: string) => new Request(`${ORIGIN}${path}`, { headers: headers() });
const send = (method: string, path: string, body: unknown) =>
  new Request(`${ORIGIN}${path}`, { method, headers: { ...headers(), "content-type": "application/json" }, body: JSON.stringify(body) });

const ART = { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false };
const BODY = { isbn: "9788998441012", art: ART, reason: { label: "이 책은", items: ["한국 소설"] }, metOn: "2026-09-30" };
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("내 책갈피 routes", () => {
  beforeEach(() => { store = memoryStore(); });
  afterEach(() => { configured = true; userId = "u1"; vi.clearAllMocks(); });

  it("/api/me says whether someone is logged in and how many bookmarks — and that login is off without config", async () => {
    expect(await (await me(get("/api/me"))).json()).toEqual({ enabled: true, loggedIn: true, id: "u1", count: 0, login: null });
    userId = null;
    expect(await (await me(get("/api/me"))).json()).toEqual({ enabled: true, loggedIn: false, id: null, count: 0, login: null });
    configured = false;
    expect(await (await me(get("/api/me"))).json()).toEqual({ enabled: false, loggedIn: false, id: null, count: 0, login: null });
  });

  it("/api/me hands over the login proof once (E-14), and counts only books still in the catalogue", async () => {
    jar.set("galpi_login", "google:1");
    store = memoryStore({ shelves: [{ id: A, name: "첫", position: 0 }], saves: [
      { isbn: "9788998441012", art: ART as never, reason: { label: "이 책은", items: [] }, metOn: "2026-10-01", shelfId: A, position: 0 },
      { isbn: "9780000000099", art: ART as never, reason: { label: "이 책은", items: [] }, metOn: "2026-10-01", shelfId: A, position: 1 },
    ] });
    expect(await (await me(get("/api/me"))).json()).toMatchObject({ loggedIn: true, count: 1, login: { provider: "google", first: true } });
    expect(jar.has("galpi_login")).toBe(false);
    expect(await (await me(get("/api/me"))).json()).toMatchObject({ login: null });
  });

  it("needs a login (401) and the Supabase config (503); other sites are refused", async () => {
    userId = null;
    expect((await save(send("POST", "/api/library/saves", BODY))).status).toBe(401);
    expect((await library(get("/api/library"))).status).toBe(401);
    configured = false;
    expect((await save(send("POST", "/api/library/saves", BODY))).status).toBe(503);
    const cross = new Request(`${ORIGIN}/api/library/saves`, { method: "POST", headers: { origin: "https://evil.example" }, body: JSON.stringify(BODY) });
    expect((await save(cross)).status).toBe(403);
  });

  it("saves a bookmark of our catalogue and shows it in the library with its card", async () => {
    const res = await save(send("POST", "/api/library/saves", BODY));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, saved: true });
    const view = await (await library(get("/api/library"))).json();
    expect(view.count).toBe(1);
    expect(view.shelves[0].bookmarks[0]).toMatchObject({ isbn: "9788998441012", art: ART, metOn: "2026-09-30", card: { title: "모순" } });
    expect((await me(get("/api/me"))).status).toBe(200);
  });

  it("refuses books outside the catalogue, made-up pictures, future dates and broken bodies", async () => {
    for (const body of [{ ...BODY, isbn: "9780000000000" }, { ...BODY, art: { ...ART, animal: "dragon" } }, { ...BODY, metOn: "2999-01-01" }, { ...BODY, reason: null }, [1]]) {
      expect((await save(send("POST", "/api/library/saves", body))).status, JSON.stringify(body)).toBe(400);
    }
    expect(store.data.saves).toHaveLength(0);
  });

  it("moves, removes, and maps service errors to statuses", async () => {
    store = memoryStore({ shelves: [{ id: A, name: "첫", position: 0 }, { id: B, name: "둘", position: 1 }] });
    await save(send("POST", "/api/library/saves", BODY));
    expect((await move(send("PATCH", "/api/library/saves", { isbn: BODY.isbn, shelfId: B }))).status).toBe(200);
    expect(store.data.saves[0].shelfId).toBe(B);
    expect((await move(send("PATCH", "/api/library/saves", { isbn: BODY.isbn, shelfId: "not-a-uuid" }))).status).toBe(400);
    expect((await move(send("PATCH", "/api/library/saves", { isbn: BODY.isbn, shelfId: B, index: 0 }))).status).toBe(200);   // a drag
    expect(store.data.saves[0]).toMatchObject({ shelfId: B, position: 0 });
    expect((await move(send("PATCH", "/api/library/saves", { isbn: BODY.isbn, shelfId: B, index: 500 }))).status).toBe(200);
    // the place counts only books still in the catalogue: one that left it is not a neighbour
    store.data.saves = [...store.data.saves, { ...store.data.saves[0], isbn: "9790000000009", shelfId: A, position: 0 }];
    expect((await move(send("PATCH", "/api/library/saves", { isbn: BODY.isbn, shelfId: A, index: 1 }))).status).toBe(200);
    expect(store.data.saves.find((s) => s.isbn === BODY.isbn)).toMatchObject({ shelfId: A, position: 0 });   // index 1 → the drawn front
    expect((await move(send("PATCH", "/api/library/saves", { isbn: BODY.isbn, shelfId: B }))).status).toBe(200);
    store.data.saves = store.data.saves.filter((s) => s.isbn !== "9790000000009");
    for (const index of [-1, 501, 1.5, "1", null, true]) {
      expect((await move(send("PATCH", "/api/library/saves", { isbn: BODY.isbn, shelfId: B, index }))).status, String(index)).toBe(400);
    }
    expect((await removeShelf(send("DELETE", "/api/library/shelves", { id: B }))).status).toBe(409);   // not empty
    expect((await unsave(send("DELETE", "/api/library/saves", { isbn: BODY.isbn }))).status).toBe(200);
    expect((await unsave(send("DELETE", "/api/library/saves", { isbn: BODY.isbn }))).status).toBe(404);
    expect((await unsave(send("DELETE", "/api/library/saves", { isbn: "x" }))).status).toBe(400);
  });

  it("[모두 제거] takes every bookmark only for exactly { all: true } and keeps the rods", async () => {
    const row = (isbn: string, shelfId: string, position: number) =>
      ({ isbn, art: ART as never, reason: { label: "이 책은" as const, items: [] }, metOn: "2026-10-01", shelfId, position });
    const shelves = [{ id: A, name: "첫", position: 0 }, { id: B, name: "둘", position: 1 }];
    store = memoryStore({ shelves, saves: [row("9788998441012", A, 0), row("9790000000009", B, 0)] });
    for (const body of [{}, { all: "true" }, { all: 1 }, { all: false }, { all: true, isbn: "9788998441012" }, [true], null]) {
      expect((await unsaveAll(send("DELETE", "/api/library/saves/all", body))).status, JSON.stringify(body)).toBe(400);
    }
    // the single delete does not take { all: true } either
    expect((await unsave(send("DELETE", "/api/library/saves", { all: true }))).status).toBe(400);
    expect(store.data.saves).toHaveLength(2);
    const res = await unsaveAll(send("DELETE", "/api/library/saves/all", { all: true }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, removed: 2 });
    expect(store.data.saves).toEqual([]);
    expect(store.data.shelves).toEqual(shelves);
    expect(await (await unsaveAll(send("DELETE", "/api/library/saves/all", { all: true }))).json()).toEqual({ ok: true, removed: 0 });
    userId = null;
    expect((await unsaveAll(send("DELETE", "/api/library/saves/all", { all: true }))).status).toBe(401);
    const cross = new Request(`${ORIGIN}/api/library/saves/all`, { method: "DELETE", headers: { origin: "https://evil.example" }, body: JSON.stringify({ all: true }) });
    expect((await unsaveAll(cross)).status).toBe(403);
  });

  it("[모두 제거] answers a database failure with a plain 500", async () => {
    store.deleteAllSaves = async () => { throw new Error("library unsave all failed: 08006"); };
    expect((await unsaveAll(send("DELETE", "/api/library/saves/all", { all: true }))).status).toBe(500);
    expect(error).toHaveBeenCalledWith("library:", "library unsave all failed: 08006");
  });

  it("adds, renames and removes rods", async () => {
    const added = await addShelf(send("POST", "/api/library/shelves", { name: " 밤에 읽기 " }));
    expect(added.status).toBe(201);
    expect(await added.json()).toMatchObject({ ok: true, shelf: { name: "밤에 읽기", position: 1 } });
    store = memoryStore({ shelves: [{ id: A, name: "첫", position: 0 }, { id: B, name: "둘", position: 1 }] });
    expect((await renameShelf(send("PATCH", "/api/library/shelves", { id: B, name: "읽을 책" }))).status).toBe(200);
    expect((await renameShelf(send("PATCH", "/api/library/shelves", { id: B, name: "" }))).status).toBe(400);
    expect((await renameShelf(send("PATCH", "/api/library/shelves", { id: 3, name: "x" }))).status).toBe(400);
    expect((await removeShelf(send("DELETE", "/api/library/shelves", { id: A }))).status).toBe(409);   // the first rod
    expect((await removeShelf(send("DELETE", "/api/library/shelves", { id: B }))).status).toBe(200);
    expect((await removeShelf(send("DELETE", "/api/library/shelves", { id: "x" }))).status).toBe(400);
  });

  it("answers a database failure with a plain 500 and logs no values", async () => {
    store.saves = async () => { throw new Error("library saves failed: 08006"); };
    const res = await library(get("/api/library"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "something went wrong" });
    expect(error).toHaveBeenCalledWith("library:", "library saves failed: 08006");
  });

  it("never caches personal answers", async () => {
    expect((await me(get("/api/me"))).headers.get("cache-control")).toBe("no-store");
    expect((await library(get("/api/library"))).headers.get("cache-control")).toBe("no-store");
  });
});
