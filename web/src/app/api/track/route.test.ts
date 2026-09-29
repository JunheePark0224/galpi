// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/track/store", () => ({ saveEvent: vi.fn().mockResolvedValue(false) }));
import { saveEvent } from "@/lib/track/store";
import { POST } from "./route";

const common = { anon_id: "a", user_id: null, session_id: "s", round: 1, entry: null, screen_version: "v1",
  referrer: "", returning: false, device: "phone", in_app_browser: false };
const req = (body: unknown) => new Request("http://x/api/track", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/track", () => {
  afterEach(() => vi.clearAllMocks());

  it("accepts a known event", async () => {
    const res = await POST(req({ name: "visit", props: {}, common }));
    expect(res.status).toBe(202);
    expect(saveEvent).toHaveBeenCalledWith({ name: "visit", props: {}, common });
  });

  it("rejects an unknown event name", async () => {
    const res = await POST(req({ name: "drop_table", props: {}, common }));
    expect(res.status).toBe(400);
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("rejects bodies that are too large", async () => {
    const res = await POST(req({ name: "visit", props: { big: "x".repeat(9000) }, common }));
    expect(res.status).toBe(400);
  });

  it("measures the size limit in bytes, not characters", async () => {
    const res = await POST(req({ name: "visit", props: { big: "가".repeat(3000) }, common }));
    expect(res.status).toBe(400);
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("rejects non-object bodies", async () => {
    for (const body of [null, 1, "visit", [1]]) {
      const res = await POST(req(body));
      expect(res.status).toBe(400);
    }
  });

  it("rejects a missing or array common", async () => {
    expect((await POST(req({ name: "visit", props: {} }))).status).toBe(400);
    expect((await POST(req({ name: "visit", props: {}, common: [] }))).status).toBe(400);
    expect(saveEvent).not.toHaveBeenCalled();
  });

  it("treats array props as empty", async () => {
    const res = await POST(req({ name: "visit", props: [1], common }));
    expect(res.status).toBe(202);
    expect(saveEvent).toHaveBeenCalledWith({ name: "visit", props: {}, common });
  });

  it("answers 500 when the store fails", async () => {
    vi.mocked(saveEvent).mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req({ name: "visit", props: {}, common }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "store failed" });
  });

  it("rejects invalid JSON", async () => {
    const res = await POST(new Request("http://x/api/track", { method: "POST", body: "{" }));
    expect(res.status).toBe(400);
  });
});
