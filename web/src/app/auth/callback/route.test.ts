// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const exchange = vi.fn();
const upsertSelect = vi.fn();
const signOut = vi.fn();
const upsert = vi.fn(() => ({ select: upsertSelect }));
let configured = true;
vi.mock("@/lib/auth/server", () => ({
  authClient: async () => (configured
    ? { auth: { exchangeCodeForSession: exchange, signOut }, from: (table: string) => (table === "profiles" ? { upsert } : null) }
    : null),
}));
const error = vi.spyOn(console, "error").mockImplementation(() => {});
import { GET } from "./route";

const call = (query: string) => GET(new Request(`https://galpi.example/auth/callback?${query}`));
const loggedIn = (provider: string) => exchange.mockResolvedValue({ data: { user: { id: "u1", app_metadata: { provider } } }, error: null });

describe("GET /auth/callback", () => {
  afterEach(() => { vi.clearAllMocks(); configured = true; });

  it("turns the code into a session and goes back to the page with the login mark — first login when the profile row is new", async () => {
    loggedIn("kakao");
    upsertSelect.mockResolvedValue({ data: [{ user_id: "u1" }], error: null });
    const res = await call("code=c1&next=%2F%3Fy%3D2");
    expect(exchange).toHaveBeenCalledWith("c1");
    expect(upsert).toHaveBeenCalledWith({ user_id: "u1", provider: "kakao" }, { onConflict: "user_id", ignoreDuplicates: true });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://galpi.example/?y=2&login=kakao&first=1");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const proof = res.headers.get("set-cookie") ?? "";
    expect(proof).toContain("galpi_login=kakao%3A1");
    expect(proof).toMatch(/HttpOnly/i);
    expect(proof).toMatch(/Max-Age=300/i);
    expect(proof).toMatch(/SameSite=lax/i);
  });

  it("leaves no login proof behind a failed login, and slows down a flood of codes", async () => {
    const res = await call("next=%2F");
    expect(res.headers.get("set-cookie") ?? "").not.toContain("galpi_login=");
    let last: Response = res;
    for (let i = 0; i < 40; i++) last = await GET(new Request("https://galpi.example/auth/callback?code=x", { headers: { "x-forwarded-for": "7.7.7.7" } }));
    expect(last.status).toBe(429);
  });

  it("is not a first login when the profile already existed", async () => {
    loggedIn("google");
    upsertSelect.mockResolvedValue({ data: [], error: null });
    const res = await call("code=c1&next=%2Flibrary");
    expect(res.headers.get("location")).toBe("https://galpi.example/library?login=google&first=0");
  });

  it("still logs in when the profile write fails (not counted as first), and logs only the error code", async () => {
    loggedIn("google");
    upsertSelect.mockResolvedValue({ data: null, error: { code: "42501", message: "secret detail" } });
    const res = await call("code=c1");
    expect(res.headers.get("location")).toBe("https://galpi.example/?login=google&first=0");
    expect(JSON.stringify(error.mock.calls)).not.toContain("secret detail");
  });

  it("never sends people off the site", async () => {
    loggedIn("kakao");
    upsertSelect.mockResolvedValue({ data: [], error: null });
    const res = await call("code=c1&next=https%3A%2F%2Fevil.example%2F");
    expect(res.headers.get("location")).toBe("https://galpi.example/?login=kakao&first=0");
  });

  it("marks a failed login: no code, a refused code, an unexpected provider, or no Supabase config", async () => {
    expect((await call("next=%2Flibrary")).headers.get("location")).toBe("https://galpi.example/library?login=failed");
    exchange.mockResolvedValue({ data: { user: null }, error: { code: "bad_code" } });
    expect((await call("code=x")).headers.get("location")).toBe("https://galpi.example/?login=failed");
    loggedIn("github");
    expect((await call("code=x")).headers.get("location")).toBe("https://galpi.example/?login=failed");
    expect(signOut).toHaveBeenCalled();
    configured = false;
    expect((await call("code=x")).headers.get("location")).toBe("https://galpi.example/?login=failed");
  });
});
