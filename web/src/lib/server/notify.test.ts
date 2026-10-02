// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDailyBudgets } from "./guard";
import { kstStamp, notifyFeedback, noticeText, NOTICES_PER_DAY } from "./notify";

const KEY = "re_test_not_a_real_key";
const TO = "owner@example.com";
const AT = new Date("2026-10-03T05:05:00Z");   // 14:05 in Seoul
const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

describe("notifyFeedback (PRD F-26 notice — time only)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    resetDailyBudgets();
    vi.stubEnv("RESEND_API_KEY", KEY);
    vi.stubEnv("FEEDBACK_NOTIFY_TO", TO);
    fetchMock.mockReset().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); warn.mockClear(); });

  it("writes the arrival time in Korea time", () => {
    expect(kstStamp(AT)).toBe("2026-10-03 14:05");
    expect(kstStamp(new Date("2026-10-02T15:30:00Z"))).toBe("2026-10-03 00:30");   // past midnight in Seoul
    expect(noticeText(AT)).toBe("2026-10-03 14:05 (KST)에 피드백이 도착했어요. Supabase events에서 feedback_sent를 확인하세요.");
  });

  it("posts one email to Resend: from 갈피, to the operator, the subject and the time only", async () => {
    expect(await notifyFeedback(AT)).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init.body))).toEqual({
      from: "갈피 <onboarding@resend.dev>", to: [TO], subject: "[갈피] 피드백이 도착했어요", text: noticeText(AT),
    });
  });

  it.each([["RESEND_API_KEY"], ["FEEDBACK_NOTIFY_TO"]])("skips without %s and warns without any value", async (name) => {
    vi.stubEnv(name, "");
    expect(await notifyFeedback(AT)).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
    const logged = warn.mock.calls.flat().map(String).join(" ");
    expect(logged).toContain("skipped");
    expect(logged).not.toContain(KEY);
    expect(logged).not.toContain(TO);
  });

  it("reports a refusal or a network error as failed, never throws, never logs the key or address", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 403 }));
    expect(await notifyFeedback(AT)).toBe("failed");
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));
    expect(await notifyFeedback(AT)).toBe("failed");
    const logged = warn.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain(KEY);
    expect(logged).not.toContain(TO);
  });

  it("gives up after 3 seconds", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => new Promise((_, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      }));
      const result = notifyFeedback(AT);
      await vi.advanceTimersByTimeAsync(3_000);
      expect(await result).toBe("failed");
    } finally {
      vi.useRealTimers();
    }
  });

  it(`stops after ${NOTICES_PER_DAY} notices a day on one instance`, async () => {
    for (let i = 0; i < NOTICES_PER_DAY; i++) await notifyFeedback(AT);
    expect(await notifyFeedback(AT)).toBe("capped");
    expect(fetchMock).toHaveBeenCalledTimes(NOTICES_PER_DAY);
  });
});
