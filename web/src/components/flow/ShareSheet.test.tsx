import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetBackHolds } from "@/lib/nav/deviceBack";
import { forgetStories } from "@/lib/share/storyFile";
import { COPIED, IMAGE_FAILED, INAPP_HINT, OUTSIDE_HINT, ShareSheet } from "./ShareSheet";

const URL_ = "https://www.galpibook.com/s/1~0A~a.b~000000";
const STORY = "/s/1~0A~a.b~000000/story";
const KAKAO = "Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36 KAKAOTALK/25.8.0 (INAPP)";
const PHONE = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const props = () => ({ shareUrl: URL_, count: 5, onClose: vi.fn(), onShared: vi.fn() });
const png = () => vi.fn().mockResolvedValue(new Response(new Blob(["png"], { type: "image/png" })));
const tile = (name: string) => screen.queryByRole("button", { name }) ?? screen.queryByRole("link", { name });

describe("ShareSheet (C-31, F-27 — 결과 공유하기)", () => {
  afterEach(() => { vi.unstubAllGlobals(); forgetStories(); forgetBackHolds(); });

  it("where pictures can be shared: preview, then 인스타 스토리로 · 이미지 저장 · 링크 공유 (E-42 image · save_image · native)", async () => {
    const fetchMock = png();
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { ...navigator, userAgent: PHONE, share, canShare: () => true });
    const p = props();
    render(<ShareSheet {...p} />);
    expect(screen.getByRole("dialog", { name: "결과 공유하기" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "스토리 이미지 미리보기" })).toHaveAttribute("src", STORY);
    expect(fetchMock).toHaveBeenCalledWith(STORY);

    const story = await screen.findByRole("button", { name: "인스타 스토리로" });
    await act(async () => { fireEvent.click(story); });
    expect((share.mock.calls[0][0].files as File[])[0].type).toBe("image/png");
    expect(p.onShared).toHaveBeenLastCalledWith("image");

    const save = screen.getByRole("link", { name: "이미지 저장" });
    expect(save).toHaveAttribute("href", STORY);
    expect(save).toHaveAttribute("download");
    fireEvent.click(save);
    expect(p.onShared).toHaveBeenLastCalledWith("save_image");

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "링크 공유" })); });
    expect(share).toHaveBeenLastCalledWith(expect.objectContaining({ url: URL_, text: expect.stringContaining("책갈피 5장") }));
    expect(p.onShared).toHaveBeenLastCalledWith("native");
  });

  it("counts nothing when a share sheet is closed, and says so when the picture could not go", async () => {
    vi.stubGlobal("fetch", png());
    const share = vi.fn().mockRejectedValueOnce(new DOMException("closed", "AbortError")).mockRejectedValueOnce(new Error("nope"));
    vi.stubGlobal("navigator", { ...navigator, userAgent: PHONE, share, canShare: () => true });
    const p = props();
    render(<ShareSheet {...p} />);
    const story = await screen.findByRole("button", { name: "인스타 스토리로" });
    await act(async () => { fireEvent.click(story); });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    await act(async () => { fireEvent.click(story); });
    expect(screen.getByRole("status")).toHaveTextContent(IMAGE_FAILED);
    expect(p.onShared).not.toHaveBeenCalled();
  });

  it("in an in-app browser (no picture sharing): a big preview to hold and save, and 링크 복사 only (E-42 copy)", async () => {
    const fetchMock = png();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { ...navigator, userAgent: KAKAO, share: undefined, canShare: undefined, clipboard: { writeText } });
    const p = props();
    render(<ShareSheet {...p} />);
    expect(screen.getByText(INAPP_HINT)).toBeInTheDocument();
    expect(screen.getByText(OUTSIDE_HINT)).toBeInTheDocument();   // the ⋯ menu way to a one-tap story share
    expect(tile("인스타 스토리로")).toBeNull();
    expect(tile("이미지 저장")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "링크 복사" })); });
    expect(writeText).toHaveBeenCalledWith(URL_);
    expect(screen.getByRole("status")).toHaveTextContent(COPIED);
    expect(p.onShared).toHaveBeenCalledWith("copy");
  });

  it("elsewhere without picture sharing (a desktop): 이미지 저장 · 링크 공유, the link copied when there is no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, userAgent: DESKTOP, share: undefined, canShare: undefined, clipboard: { writeText } });
    const p = props();
    render(<ShareSheet {...p} />);
    expect(tile("인스타 스토리로")).toBeNull();
    expect(screen.getByRole("link", { name: "이미지 저장" })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "링크 공유" })); });
    expect(p.onShared).toHaveBeenCalledWith("copy");
  });

  it("a refused clipboard shows the link to copy by hand", async () => {
    vi.stubGlobal("navigator", { ...navigator, userAgent: DESKTOP, share: undefined, canShare: undefined, clipboard: { writeText: vi.fn().mockRejectedValue(new Error("no")) } });
    const p = props();
    render(<ShareSheet {...p} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "링크 공유" })); });
    expect(screen.getByRole("textbox", { name: "공유 링크" })).toHaveValue(URL_);
    expect(p.onShared).not.toHaveBeenCalled();
  });

  it("keeps the 인스타 스토리로 place, greyed, until the picture is here — the tiles never shift (10-08)", async () => {
    let arrive: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>((r) => { arrive = r; })));
    vi.stubGlobal("navigator", { ...navigator, userAgent: PHONE, share: vi.fn(), canShare: () => true });
    render(<ShareSheet {...props()} />);
    const waiting = screen.getByRole("button", { name: "준비 중…" });
    expect(waiting).toBeDisabled();
    await act(async () => { arrive(new Response(new Blob(["png"], { type: "image/png" }))); });
    expect(screen.getByRole("button", { name: "인스타 스토리로" })).toBeEnabled();
  });

  it("drops the tile when the picture does not come; saving and the link stay", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    vi.stubGlobal("navigator", { ...navigator, userAgent: PHONE, share: vi.fn(), canShare: () => true });
    render(<ShareSheet {...props()} />);
    await act(async () => {});
    expect(tile("준비 중…")).toBeNull();
    expect(tile("인스타 스토리로")).toBeNull();
    expect(screen.getByRole("link", { name: "이미지 저장" })).toBeInTheDocument();
  });

  it("starts the picture share on the tap itself — nothing awaited first (iOS needs the tap)", async () => {
    vi.stubGlobal("fetch", png());
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, userAgent: PHONE, share, canShare: () => true });
    render(<ShareSheet {...props()} />);
    const story = await screen.findByRole("button", { name: "인스타 스토리로" });
    fireEvent.click(story);
    expect(share).toHaveBeenCalledTimes(1);
    await act(async () => {});
  });

  it("a link share sheet closed by the person counts nothing and copies nothing", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", {
      ...navigator, userAgent: DESKTOP, canShare: undefined, clipboard: { writeText },
      share: vi.fn().mockRejectedValue(new DOMException("closed", "AbortError")),
    });
    const p = props();
    render(<ShareSheet {...p} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "링크 공유" })); });
    expect(writeText).not.toHaveBeenCalled();
    expect(p.onShared).not.toHaveBeenCalled();
  });

  it("is a modal: focus starts on its title and Tab stays inside", () => {
    vi.stubGlobal("navigator", { ...navigator, userAgent: DESKTOP, canShare: undefined });
    render(<ShareSheet {...props()} />);
    expect(screen.getByRole("heading", { name: "결과 공유하기" })).toHaveFocus();
    const close = screen.getByRole("button", { name: "닫기" });
    close.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("link", { name: "이미지 저장" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(close).toHaveFocus();
  });

  it("closes with 닫기, a tap outside, Esc, or the phone's back key", () => {
    vi.stubGlobal("navigator", { ...navigator, userAgent: DESKTOP, canShare: undefined });
    const p = props();
    render(<ShareSheet {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    fireEvent.click(document.querySelector("[data-backdrop]")!);   // the sheet is on document.body (a portal)
    fireEvent.keyDown(document, { key: "Escape" });
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));   // the phone's back key (10-08)
    expect(p.onClose).toHaveBeenCalledTimes(4);
  });
});
