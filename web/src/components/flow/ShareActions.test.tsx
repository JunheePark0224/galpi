import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IMAGE_FAILED, KAKAO_NOTE, OPEN_OUTSIDE, SHARE, SHARE_IMAGE, ShareActions } from "./ShareActions";

const URL_ = "https://www.galpibook.com/s/1~0A~a.b~000000";
const KAKAO = "Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36 KAKAOTALK/25.8.0 (INAPP)";
const props = (over: Partial<Parameters<typeof ShareActions>[0]> = {}) => ({
  shareUrl: URL_, count: 5, variant: "secondary" as const, handOver: true, onShared: vi.fn(), ...over,
});
const png = () => vi.fn().mockResolvedValue(new Response(new Blob(["png"], { type: "image/png" })));

describe("ShareActions (F-27 — link, picture, and KakaoTalk's in-app browser)", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("fetches the story image beforehand and [이미지로 공유] hands the file to the share sheet (E-42 image)", async () => {
    const fetchMock = png();
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { ...navigator, share, canShare: () => true });
    const p = props();
    render(<ShareActions {...p} />);
    const button = await screen.findByRole("button", { name: SHARE_IMAGE });
    expect(fetchMock).toHaveBeenCalledWith("/s/1~0A~a.b~000000/story");
    await act(async () => { fireEvent.click(button); });
    const files = share.mock.calls[0][0].files as File[];
    expect(files).toHaveLength(1);
    expect(files[0].type).toBe("image/png");
    expect(p.onShared).toHaveBeenCalledWith("image");
  });

  it("counts nothing when the sheet was closed, and says so when the picture could not be shared", async () => {
    vi.stubGlobal("fetch", png());
    const share = vi.fn().mockRejectedValueOnce(new DOMException("closed", "AbortError")).mockRejectedValueOnce(new Error("nope"));
    vi.stubGlobal("navigator", { ...navigator, share, canShare: () => true });
    const p = props();
    render(<ShareActions {...p} />);
    const button = await screen.findByRole("button", { name: SHARE_IMAGE });
    await act(async () => { fireEvent.click(button); });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    await act(async () => { fireEvent.click(button); });
    expect(screen.getByRole("status")).toHaveTextContent(IMAGE_FAILED);
    expect(p.onShared).not.toHaveBeenCalled();
  });

  it("shows no [이미지로 공유] where files cannot be shared, or when the picture did not come", async () => {
    const fetchMock = png();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { ...navigator, canShare: undefined });
    const { unmount } = render(<ShareActions {...props()} />);
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: SHARE_IMAGE })).toBeNull();
    unmount();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    vi.stubGlobal("navigator", { ...navigator, canShare: () => true });
    render(<ShareActions {...props()} />);
    await act(async () => {});
    expect(screen.queryByRole("button", { name: SHARE_IMAGE })).toBeNull();
    expect(screen.getByRole("button", { name: SHARE })).toBeInTheDocument();
  });

  it("inside KakaoTalk opens the person's own back cover in the phone's browser instead — and sends nothing", async () => {
    const fetchMock = png();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { ...navigator, userAgent: KAKAO, canShare: () => true });
    const p = props();
    render(<ShareActions {...p} />);
    await act(async () => {});
    const out = screen.getByRole("link", { name: OPEN_OUTSIDE });
    expect(out).toHaveAttribute("href", `kakaotalk://web/openExternal?url=${encodeURIComponent(`${URL_}?mine=1`)}`);
    expect(screen.getByText(KAKAO_NOTE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: SHARE })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(p.onShared).not.toHaveBeenCalled();
  });

  it("the page it hands over to shares as usual even inside KakaoTalk, so it never loops", () => {
    vi.stubGlobal("navigator", { ...navigator, userAgent: KAKAO });
    render(<ShareActions {...props({ handOver: false, variant: "primary" })} />);
    expect(screen.getByRole("button", { name: SHARE })).toHaveAttribute("data-variant", "primary");
    expect(screen.queryByRole("link", { name: OPEN_OUTSIDE })).toBeNull();
  });
});
