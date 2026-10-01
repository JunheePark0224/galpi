// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn().mockResolvedValue({ error: null });
const from = vi.fn(() => ({ insert }));
const createClient = vi.fn(() => ({ from }));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const event = { name: "site_visited", props: {}, common: {} };

async function loadStore() {
  vi.resetModules();
  return import("./store");
}

describe("saveEvent", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("inserts into events when configured", async () => {
    vi.stubEnv("TRACK_STORE", "");
    const { saveEvent } = await loadStore();
    await expect(saveEvent(event)).resolves.toBe(true);
    expect(from).toHaveBeenCalledWith("events");
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("does not create a client or write when TRACK_STORE=off", async () => {
    vi.stubEnv("TRACK_STORE", "off");
    const { saveEvent } = await loadStore();
    await expect(saveEvent(event)).resolves.toBe(false);
    expect(createClient).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns false when Supabase is not configured", async () => {
    vi.stubEnv("TRACK_STORE", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { saveEvent } = await loadStore();
    await expect(saveEvent(event)).resolves.toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });
});
