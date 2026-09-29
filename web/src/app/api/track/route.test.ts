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

  it("rejects invalid JSON", async () => {
    const res = await POST(new Request("http://x/api/track", { method: "POST", body: "{" }));
    expect(res.status).toBe(400);
  });
});
