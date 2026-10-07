import { afterEach, describe, expect, it, vi } from "vitest";
import { canShareImages, forgetStories, storyFile } from "./storyFile";

const png = () => vi.fn().mockResolvedValue(new Response(new Blob(["png"], { type: "image/png" })));

describe("storyFile — the story picture, fetched once per share code (F-27, 10-08)", () => {
  afterEach(() => { vi.unstubAllGlobals(); forgetStories(); });

  it("fetches a story once: the back cover asks first, the sheet gets the same file", async () => {
    const fetchMock = png();
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([storyFile("/s/x/story"), storyFile("/s/x/story")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(a?.type).toBe("image/png");
    expect(await storyFile("/s/x/story")).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("is null when the picture did not come — and asks again next time", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    expect(await storyFile("/s/y/story")).toBeNull();
    const fetchMock = png();
    vi.stubGlobal("fetch", fetchMock);
    expect(await storyFile("/s/y/story")).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("knows whether this browser can hand a picture to the share sheet", () => {
    vi.stubGlobal("navigator", { ...navigator, canShare: undefined });
    expect(canShareImages()).toBe(false);
    vi.stubGlobal("navigator", { ...navigator, canShare: (d: { files?: File[] }) => (d.files?.[0]?.size ?? 0) > 0 });
    expect(canShareImages()).toBe(true);   // the probe is not an empty file
  });
});
