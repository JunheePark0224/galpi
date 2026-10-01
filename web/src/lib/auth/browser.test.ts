import { afterEach, describe, expect, it, vi } from "vitest";

const signInWithOAuth = vi.fn().mockResolvedValue({ error: null });
const signOut = vi.fn().mockResolvedValue({ error: null });
const create = vi.fn(() => ({ auth: { signInWithOAuth, signOut } }));
vi.mock("@supabase/ssr", () => ({ createBrowserClient: create }));

async function load(configured = true) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", configured ? "https://p.supabase.co" : "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", configured ? "anon" : "");
  return import("./browser");
}

describe("browser auth", () => {
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

  it("is off without the Supabase config — no login place is shown", async () => {
    const { authEnabled, startLogin } = await load(false);
    expect(authEnabled()).toBe(false);
    await expect(startLogin("kakao", "/")).resolves.toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("starts Kakao / Google login and comes back through /auth/callback to the same page", async () => {
    const { authEnabled, startLogin } = await load();
    expect(authEnabled()).toBe(true);
    await expect(startLogin("kakao", "/?y=2")).resolves.toBe(true);
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "kakao",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent("/?y=2")}` },
    });
    await startLogin("google", "https://evil.example/");
    expect(signInWithOAuth).toHaveBeenLastCalledWith({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent("/")}` },
    });
    expect(create).toHaveBeenCalledTimes(1);   // one client per page
  });

  it("reports a login that could not start", async () => {
    const { startLogin } = await load();
    signInWithOAuth.mockResolvedValueOnce({ error: { message: "x" } });
    await expect(startLogin("google", "/")).resolves.toBe(false);
  });

  it("logs out of this browser only", async () => {
    const { logout } = await load();
    await expect(logout()).resolves.toBe(true);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
