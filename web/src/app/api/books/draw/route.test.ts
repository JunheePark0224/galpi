// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyTicket } from "@/lib/collection/ticket";
import { POST } from "./route";

vi.mock("server-only", () => ({}));
const PATH = { answers: DATA_PATH };
const ORIGIN = "http://x";
const from = (ip: string) => ({ origin: ORIGIN, "x-forwarded-for": ip });
let userId: string | null = null;
let lookups = 0;
let failLookup = false;
/** The logged-in person's 내 책갈피 as the saves table answers (null data + error = the query failed). */
let saved: string[] = [];
let savesError: { code: string } | null = null;
const savesQueries: { column: string; value: string }[] = [];
vi.mock("@/lib/auth/server", () => ({
  authClient: async () => {
    lookups += 1;
    if (failLookup) throw new Error("auth down");
    return {
      from: (table: string) => ({
        select: () => ({
          eq: async (column: string, value: string) => {
            savesQueries.push({ column, value: `${table}:${value}` });
            return savesError ? { data: null, error: savesError } : { data: saved.map((isbn) => ({ isbn })), error: null };
          },
        }),
      }),
    };
  },
  sessionUserId: async () => userId,
}));
import sample from "@/data/books.sample.json";
import { toBook } from "@/lib/books/catalog";
import type { CatalogBook } from "@/lib/books/types";
import { inScope, QUESTION_MAP, walkPath } from "@/lib/paths";
import { CHALLENGE_PATH, DATA_PATH } from "@/lib/paths/__fixtures__/paths";

const BOOKS = sample as unknown as CatalogBook[];
const USER = "11111111-1111-4111-8111-111111111111";
const LOGGED_IN = { ...from("9.9.9.9"), cookie: "sb-abc-auth-token=x" };

const req = (body: unknown, headers: Record<string, string> = from("9.9.9.9")) =>
  new Request("http://x/api/books/draw", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers });

describe("POST /api/books/draw", () => {
  beforeEach(() => vi.stubEnv("BOOKS_SOURCE", "sample"));
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    userId = null;
    saved = [];
    savesError = null;
    savesQueries.length = 0;
  });

  it("is reproducible for a seed", async () => {
    const { art: artA, ...a } = await (await POST(req({ ...PATH, seed: 11 }))).json();
    const { art: artB, ...b } = await (await POST(req({ ...PATH, seed: 11 }))).json();
    expect(a).toEqual(b);
    expect(artA.seed).not.toBe(artB.seed);   // 도감 v1: the request's seed replays the books, never the pictures
  });

  it("sends only what a bookmark shows — no scores, no tags", async () => {
    const body = await (await POST(req({ ...PATH, seed: 3 }))).json();
    expect(Object.keys(body.picks[0]).sort()).toEqual(["card", "kind", "reason"]);
    expect(body.picks[0].reason).toMatchObject({ label: expect.stringMatching(/^(나온 이유|이 책은)$/), items: expect.any(Array) });
    expect(Object.keys(body.picks[0].card).sort()).toEqual(["author", "entry", "field", "genre", "id", "oneLiner", "oneLinerStyle", "title"]);
  });

  it("refuses another origin with 403", async () => {
    const res = await POST(req(PATH, { origin: "https://evil.example", "x-forwarded-for": "9.9.9.9" }));
    expect(res.status).toBe(403);
  });

  it("refuses a request with neither Origin nor Referer", async () => {
    expect((await POST(req(PATH, {}))).status).toBe(403);
  });

  it("answers 429 with Retry-After after 60 draws a minute from one address", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });   // frozen clock: the 60 draws cannot straddle a minute boundary
    vi.setSystemTime(new Date("2026-10-04T12:00:10Z"));
    for (let i = 0; i < 60; i++) expect((await POST(req({ ...PATH, seed: i }, from("7.7.7.7")))).status).toBe(200);
    const res = await POST(req(PATH, from("7.7.7.7")));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it.each([
    ["not JSON", "{"],
    ["a v1 body", { entry: "leaf", choices: ["A", "B", "A", "B", "A", "B", "A", "B", "A"] }],
    ["an unfinished path", { answers: DATA_PATH.slice(0, 2) }],
    ["an unknown answer", { answers: [{ node: "start", choice: "C" }] }],
    ["seen that is not a list of ids", { ...PATH, seen: "9790000000001" }],
    ["a negative seed", { ...PATH, seed: -1 }],
  ])("rejects %s with 400", async (_, body) => {
    expect((await POST(req(body))).status).toBe(400);
  });

  it("answers 400, not 500, when the client aborts mid-body", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(new TextEncoder().encode('{"entry":')); },
      pull() { throw new Error("aborted"); },
    });
    const res = await POST(new Request("http://x/api/books/draw", { method: "POST", headers: from("9.9.9.9"), body: stream, duplex: "half" } as RequestInit));
    expect(res.status).toBe(400);
  });

  it("rejects a body over the size cap with 413", async () => {
    const seen = Array.from({ length: 2500 }, (_, i) => `id-${i}-padding`);
    expect((await POST(req({ ...PATH, seen }))).status).toBe(413);
  });

  it("draws five bookmarks for a v2 path and returns the path S-04 shows", async () => {
    const res = await POST(req({ answers: DATA_PATH, seen: [], seed: 7 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.picks).toHaveLength(5);
    expect(Object.keys(body).sort()).toEqual(["art", "challenge", "exhausted", "label", "path", "picks", "widened"]);   // label (F-27): choice words only, never a book's tags
    expect(body.path.crumbs.at(-1)).toBe("표로 (엑셀)");
    expect(body.challenge).toBeNull();
    expect(Object.keys(body.picks[0].card).sort()).toEqual(["author", "entry", "field", "genre", "id", "oneLiner", "oneLinerStyle", "title"]);
  });

  it("a challenge path carries where it moved from and to, by which far rule (10-05 v2)", async () => {
    const body = await (await POST(req({ answers: CHALLENGE_PATH, seen: [], seed: 7 }))).json();
    expect(body.challenge).toMatchObject({ from: ["SF·판타지"], to: ["에세이", "시"], rule: { n: 1 }, reason: "딴 세상에서 지금 여기의 문장으로" });
  });

  it("signs the pictures' seed for the 도감 (dev secret outside production)", async () => {
    const { art, picks } = await (await POST(req({ ...PATH, seed: 5 }))).json();
    expect(art.isbns).toEqual(picks.map((p: { card: { id: string } }) => p.card.id));      // v3: the draw's books, signed in order
    expect(art).toMatchObject({ count: 5, seed: expect.any(Number), iat: expect.any(Number), sub: null, sig: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) });
    expect(Math.abs(art.iat - Date.now() / 1000)).toBeLessThan(5);
    expect(verifyTicket(art, "galpi-dev-only-collection-secret-not-for-production")).toBe(true);
  });

  it("binds the ticket to the logged-in person when the request carries a session", async () => {
    userId = "11111111-1111-4111-8111-111111111111";
    const { art } = await (await POST(req({ ...PATH, seed: 5 }, { ...from("9.9.9.9"), cookie: "sb-abc-auth-token=x" }))).json();
    expect(art.sub).toBe(userId);
    expect(verifyTicket(art, "galpi-dev-only-collection-secret-not-for-production")).toBe(true);
    expect(verifyTicket({ ...art, sub: null }, "galpi-dev-only-collection-secret-not-for-production")).toBe(false);
    userId = null;
  });

  it("looks the session up only when an auth cookie is there, and a failed lookup leaves the ticket unbound", async () => {
    lookups = 0;
    await POST(req({ ...PATH, seed: 5 }));
    expect(lookups).toBe(0);
    failLookup = true;
    const { art } = await (await POST(req({ ...PATH, seed: 5 }, { ...from("9.9.9.9"), cookie: "sb-abc-auth-token=x" }))).json();
    expect(lookups).toBe(1);
    expect(art.sub).toBeNull();
    failLookup = false;
  });

  it("fails closed in production without the secret: the pictures' seed comes unsigned", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COLLECTION_SIGNING_SECRET", "");
    const { art } = await (await POST(req({ ...PATH, seed: 5 }))).json();
    expect(art).toMatchObject({ count: 5, sig: null });
  });

  describe("saved books are never drawn again (10-07)", () => {
    const ids = (body: { picks: { card: { id: string } }[] }) => body.picks.map((p) => p.card.id);
    const scope = walkPath(QUESTION_MAP, DATA_PATH).scope;
    const inSqlScope = BOOKS.filter((b) => inScope(toBook(b), scope)).map((b) => b.isbn);

    it("leaves out the logged-in person's saved books, looked up from the session — one query, by their id", async () => {
      const first = ids(await (await POST(req({ ...PATH, seed: 7 }))).json());
      userId = USER;
      saved = first;
      const body = await (await POST(req({ ...PATH, seed: 7 }, LOGGED_IN))).json();
      expect(body.picks).toHaveLength(5);
      expect(ids(body).some((id) => first.includes(id))).toBe(false);
      expect(savesQueries).toEqual([{ column: "user_id", value: `saves:${USER}` }]);
      expect(body.art.sub).toBe(USER);
    });

    it("never asks for saves without a session, and keeps the response shape", async () => {
      saved = BOOKS.map((b) => b.isbn);   // would empty the catalogue if it were (wrongly) applied
      const body = await (await POST(req({ ...PATH, seed: 7 }))).json();
      expect(savesQueries).toEqual([]);
      expect(body.picks).toHaveLength(5);
      expect(Object.keys(body).sort()).toEqual(["art", "challenge", "exhausted", "label", "path", "picks", "widened"]);   // label (F-27): choice words only, never a book's tags
    });

    it("a failed saves lookup still draws (nothing left out) and logs the code only", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      userId = USER;
      savesError = { code: "57014" };
      const res = await POST(req({ ...PATH, seed: 7 }, LOGGED_IN));
      expect(res.status).toBe(200);
      expect((await res.json()).picks).toHaveLength(5);
      expect(error).toHaveBeenCalledWith("draw: saved lookup failed", expect.stringContaining("57014"));
    });

    it("every book of the scope saved: the draw widens up the path, none of them comes back", async () => {
      userId = USER;
      saved = inSqlScope;
      const body = await (await POST(req({ ...PATH, seed: 7 }, LOGGED_IN))).json();
      expect(body.picks).toHaveLength(5);
      expect(ids(body).some((id) => inSqlScope.includes(id))).toBe(false);
      expect(body.widened).toBe(true);
    });

    it("nearly every book saved: the few left are drawn and the draw says it ran out", async () => {
      const left = BOOKS.filter((b) => b.entry === "target").slice(0, 2).map((b) => b.isbn);
      userId = USER;
      saved = BOOKS.map((b) => b.isbn).filter((isbn) => !left.includes(isbn));
      const body = await (await POST(req({ ...PATH, seed: 7 }, LOGGED_IN))).json();
      expect(ids(body).every((id) => left.includes(id))).toBe(true);
      expect(body.exhausted).toBe(true);
      expect(body.art.count).toBe(body.picks.length);
    });

    it("saved books and this tab's seen are left out together", async () => {
      const first = ids(await (await POST(req({ ...PATH, seed: 7 }))).json());
      userId = USER;
      saved = first.slice(0, 2);
      const body = await (await POST(req({ ...PATH, seen: first.slice(2), seed: 7 }, LOGGED_IN))).json();
      expect(ids(body).some((id) => first.includes(id))).toBe(false);
    });
  });
});
