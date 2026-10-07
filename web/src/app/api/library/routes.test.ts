// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryStore } from "@/lib/library/__fixtures__/memoryStore";
import { LibraryWriteOff, type LibraryStore } from "@/lib/library/types";
import { artsForDraw, collectibleParts, tierOf } from "@/lib/art/combine";
import { CollectionUnavailable } from "@/lib/collection/types";

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
// 0007 claims, shared by everyone in a test (the collection store is only used for claims here)
let claims: Map<string, string>;
let claimsMissing = false;
let dexWriter = true;
let recorded: { uid: string; art: unknown }[];
vi.mock("@/lib/collection/supabaseStore", () => ({
  collectionWriter: () => (dexWriter ? {} : null),
  supabaseCollection: (_r: unknown, w: unknown, uid: string) => ({
    claimKept: async ({ seed, iat, index }: { seed: number; iat: number; index: number }) => {
      if (claimsMissing) throw new CollectionUnavailable();
      const key = `${seed}:${iat}:${index}`;
      if (!claims.has(key)) claims.set(key, uid);
      return claims.get(key) === uid;
    },
    record: async (art: Parameters<typeof collectibleParts>[0]) => {
      if (!w) throw new Error("collection writes are off");
      recorded.push({ uid, art });
      return collectibleParts(art);
    },
  }),
}));
const error = vi.spyOn(console, "error").mockImplementation(() => {});

import { issueTicket } from "@/lib/collection/ticket";
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
  beforeEach(() => { store = memoryStore(); claims = new Map(); recorded = []; });
  afterEach(() => { configured = true; userId = "u1"; claimsMissing = false; dexWriter = true; vi.unstubAllEnvs(); vi.clearAllMocks(); });

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
    expect(view.shelves[0].bookmarks[0]).toMatchObject({ isbn: "9788998441012", metOn: "2026-09-30", card: { title: "모순" } });
    expect((await me(get("/api/me"))).status).toBe(200);
  });

  describe("the picture is the server's (v1.7.1 security review) — the art the browser sends is never stored while signing is on", () => {
    const ISBN = "9788998441012";
    const DRAW = ["9788937460449", ISBN, "9790000000000", "9790000000001", "9790000000002"];   // ISBN is bookmark 1
    const proof = (opts: { sub?: string | null; iat?: number; seed?: number } = {}) => ({ ...issueTicket(DRAW, { seed: 777, iat: 1_790_000_000, ...opts }), index: 1 });
    const DRAWN = artsForDraw(5, 777)[1];
    const savedArt = () => store.data.saves[0]?.art;
    const notDrawn = { ...ART, animal: DRAWN.animal === "fox" ? "owl" : "fox" };

    it("with the draw's ticket: the bookmark's own picture from the seed, whatever art was sent — a logged-in draw of this person, any age", async () => {
      userId = A;
      const res = await save(send("POST", "/api/library/saves", { ...BODY, art: notDrawn, ticket: proof({ sub: A, iat: 1 }) }));
      expect(res.status).toBe(200);
      expect(savedArt()).toEqual(DRAWN);
      expect(claims.size).toBe(0);                                                // a logged-in draw needs no claim
    });

    it("a logged-out draw: claimed by this person (once — the same person again is fine), its parts recorded and returned for E-36", async () => {
      userId = A;
      const res = await save(send("POST", "/api/library/saves", { ...BODY, art: notDrawn, ticket: proof() }));
      expect(savedArt()).toEqual(DRAWN);
      expect([...claims.values()]).toEqual([A]);
      expect(recorded).toEqual([{ uid: A, art: DRAWN }]);
      expect((await res.json()).found).toEqual(collectibleParts(DRAWN).map((p) => ({ ...p, tier: tierOf(p.kind, p.value) })));
      store = memoryStore();
      await save(send("POST", "/api/library/saves", { ...BODY, ticket: proof() }));
      expect(savedArt()).toEqual(DRAWN);
    });

    it("a proof that does not hold keeps the bookmark but with a picture the server chose: another's claim, another book, another person's draw, a forged signature", async () => {
      userId = B;
      claims.set("777:" + proof().iat + ":1", A);                                  // A claimed this bookmark already
      const cases = [
        { ticket: proof() },
        { ticket: { ...proof({ sub: B }), index: 0 } },                             // bookmark 0 is another book
        { ticket: proof({ sub: A }) },                                              // A's logged-in draw
        { ticket: { ...proof({ sub: B }), sig: "A".repeat(43) } },
      ];
      for (const extra of cases) {
        store = memoryStore();
        const res = await save(send("POST", "/api/library/saves", { ...BODY, art: DRAWN, ...extra }));
        expect(res.status, JSON.stringify(extra)).toBe(200);
        expect(store.data.saves).toHaveLength(1);
        expect(savedArt(), JSON.stringify(extra)).not.toBe(undefined);
      }
      // over many tries the server's own picture is not the claimed one every time (it is random, not the sent art)
      const pictures = new Set<string>();
      for (let i = 0; i < 20; i++) {
        store = memoryStore();
        await save(send("POST", "/api/library/saves", { ...BODY, art: DRAWN, ticket: proof() }));
        pictures.add(JSON.stringify(savedArt()));
      }
      expect(pictures.size).toBeGreaterThan(1);
    });

    it("no ticket (a guest bookmark kept before this fix): a picture the server chose", async () => {
      const pictures = new Set<string>();
      for (let i = 0; i < 20; i++) {
        store = memoryStore();
        await save(send("POST", "/api/library/saves", BODY));
        pictures.add(JSON.stringify(savedArt()));
      }
      expect(pictures.size).toBeGreaterThan(1);
    });

    it("0007 not applied yet: a verified logged-out draw still gets its own picture, but nothing goes into the 도감", async () => {
      claimsMissing = true;
      const res = await save(send("POST", "/api/library/saves", { ...BODY, ticket: proof() }));
      expect(savedArt()).toEqual(DRAWN);
      expect(recorded).toEqual([]);
      expect((await res.json()).found).toEqual([]);
    });

    it("no 도감 writer (no service key): the picture is still the drawn one, nothing recorded; a logged-in draw records nothing here", async () => {
      dexWriter = false;
      await save(send("POST", "/api/library/saves", { ...BODY, ticket: proof() }));
      expect(savedArt()).toEqual(DRAWN);
      dexWriter = true;
      store = memoryStore();
      userId = A;
      const res = await save(send("POST", "/api/library/saves", { ...BODY, ticket: proof({ sub: A }) }));
      expect(recorded).toEqual([]);                                             // S-05 recorded the person's own draws
      expect((await res.json()).found).toEqual([]);
    });

    it("a broken ticket is a broken body (400)", async () => {
      for (const ticket of [{ ...proof(), isbns: undefined }, { ...proof(), index: 9 }, "x"]) {
        expect((await save(send("POST", "/api/library/saves", { ...BODY, ticket }))).status, JSON.stringify(ticket)).toBe(400);
      }
      expect(store.data.saves).toHaveLength(0);
    });

    it("signing off (production without the secret): the sent picture, as before", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("COLLECTION_SIGNING_SECRET", "");
      await save(send("POST", "/api/library/saves", { ...BODY, ticket: proof() }));
      expect(savedArt()).toEqual(ART);
    });
  });

  it("fails closed when the server cannot save bookmarks (no service key, 0007): 503, nothing saved", async () => {
    const real = store.insertSave;
    store.insertSave = async () => { throw new LibraryWriteOff(); };
    expect((await save(send("POST", "/api/library/saves", BODY))).status).toBe(503);
    store.insertSave = real;
    expect(store.data.saves).toHaveLength(0);
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

  it("[막대 지우기] takes a rod with its bookmarks only for { id, withBookmarks: true } — never the first rod", async () => {
    const row = (isbn: string, shelfId: string, position: number) =>
      ({ isbn, art: ART as never, reason: { label: "이 책은" as const, items: [] }, metOn: "2026-10-01", shelfId, position });
    store = memoryStore({
      shelves: [{ id: A, name: "첫", position: 0 }, { id: B, name: "둘", position: 1 }],
      saves: [row("9788998441012", A, 0), row("9790000000009", B, 0), row("9790000000016", B, 1)],
    });
    for (const body of [{ id: B, withBookmarks: "true" }, { id: B, withBookmarks: 1 }, { id: B, withBookmarks: true, all: true }]) {
      expect((await removeShelf(send("DELETE", "/api/library/shelves", body))).status, JSON.stringify(body)).toBe(400);
    }
    expect((await removeShelf(send("DELETE", "/api/library/shelves", { id: B }))).status).toBe(409);       // not empty: asked plainly
    expect((await removeShelf(send("DELETE", "/api/library/shelves", { id: A, withBookmarks: true }))).status).toBe(409);
    expect(store.data.saves).toHaveLength(3);
    const res = await removeShelf(send("DELETE", "/api/library/shelves", { id: B, withBookmarks: true }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, removed: 2 });
    expect(store.data.shelves.map((s) => s.id)).toEqual([A]);
    expect(store.data.saves.map((s) => s.isbn)).toEqual(["9788998441012"]);
    userId = null;
    expect((await removeShelf(send("DELETE", "/api/library/shelves", { id: A, withBookmarks: true }))).status).toBe(401);
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
