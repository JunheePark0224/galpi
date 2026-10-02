import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const trackStored = vi.fn();
vi.mock("@/lib/track/client", () => ({ trackStored: (...a: unknown[]) => trackStored(...a) }));
import { sendFeedback } from "./send";

const LETTER = "결과 화면이 조금 느렸어요";

describe("sendFeedback (PRD F-26)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ stored: true }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); trackStored.mockReset(); });

  it("posts the trimmed letter with the common props, and only after a 2xx sends E-31's Amplitude copy with the same common", async () => {
    expect(await sendFeedback(`  ${LETTER} `)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/feedback");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body.text).toBe(LETTER);
    expect(body.common.anon_id).toEqual(expect.any(String));
    expect(trackStored).toHaveBeenCalledWith("feedback_sent", { feedback_text: LETTER, text_length: LETTER.length }, body.common);
  });

  it("counts a 202 (store off, local) as sent too", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ stored: false }), { status: 202 }));
    expect(await sendFeedback(LETTER)).toBe(true);
  });

  it.each([[500], [429], [400]])("answers false on %i and sends no analytics", async (status) => {
    fetchMock.mockResolvedValue(new Response("{}", { status }));
    expect(await sendFeedback(LETTER)).toBe(false);
    expect(trackStored).not.toHaveBeenCalled();
  });

  it("answers false when the network fails, without throwing", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    await expect(sendFeedback(LETTER)).resolves.toBe(false);
    expect(trackStored).not.toHaveBeenCalled();
  });

  it("sends nothing for an empty letter", async () => {
    expect(await sendFeedback("  \n ")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
