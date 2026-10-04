import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryView } from "@/lib/library/types";
import { libraryGuide } from "@/lib/flow/firstGuide";

const track = vi.fn();
const request = vi.fn();
const logout = vi.fn();
const setAmplitudeUser = vi.fn();
vi.mock("@/lib/track/client", () => ({ track: (...a: unknown[]) => track(...a) }));
vi.mock("@/lib/library/client", () => ({ libraryRequest: (...a: unknown[]) => request(...a) }));
vi.mock("@/lib/auth/browser", () => ({ logout: () => logout() }));
vi.mock("@/lib/track/amplitude", () => ({ setAmplitudeUser: (...a: unknown[]) => setAmplitudeUser(...a) }));

const ART = { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false } as const;
const card = (id: string, title: string) => ({ id, entry: "leaf" as const, title, author: "가", genre: "한국 소설", field: null, oneLiner: "?", oneLinerStyle: "question" as const });
const bm = (isbn: string, title: string) => ({ isbn, art: { ...ART }, reason: { label: "나온 이유" as const, items: ["따뜻함"] }, metOn: "2026-10-01", card: card(isbn, title) });
const VIEW: LibraryView = {
  count: 2, animals: 1,
  shelves: [
    { id: "a", name: "읽을 책", position: 0, bookmarks: [bm("9788998441012", "모순"), bm("9788937460449", "데미안")] },
    { id: "b", name: "마음에 남은", position: 1, bookmarks: [] },
  ],
};
const ok = (body: unknown = { ok: true }) => ({ ok: true, status: 200, body });

async function mount(me: unknown) {
  vi.resetModules();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => me }));
  const { Library } = await import("./Library");
  const store = await import("@/lib/account/store");
  await act(async () => { render(<Library />); });
  return store;
}
const IN = { enabled: true, loggedIn: true, id: "u1", count: 2 };

describe("Library (S-09)", () => {
  // C-22 is covered by LibraryGuide.test and e2e/library.spec — here the guide counts as seen
  beforeEach(() => { request.mockReset(); request.mockResolvedValue(ok(VIEW)); libraryGuide.markSeen(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it("logged out: offers the login instead of the rods", async () => {
    const store = await mount({ enabled: true, loggedIn: false, id: null, count: 0 });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(store.loginSheetSnapshot()).toEqual({ source: "header" });
    expect(request).not.toHaveBeenCalled();
  });

  it("shows the count, the animal kinds and each rod with its bookmarks — rod names masked, never in attributes", async () => {
    await mount(IN);
    expect(await screen.findByText("2개 · 동물 1종")).toBeInTheDocument();
    const name = screen.getByRole("heading", { name: "읽을 책" });
    expect(name).toHaveAttribute("data-amp-mask");
    expect(screen.getByRole("list", { name: "읽을 책" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "모순 책갈피" })).toBeInTheDocument();
    expect(screen.getByText("아직 비어 있어요")).toBeInTheDocument();
    for (const el of document.querySelectorAll("*")) {
      for (const attr of el.getAttributeNames()) expect(el.getAttribute(attr) ?? "", attr).not.toContain("마음에 남은");
    }
    expect(track).toHaveBeenCalledWith("library_viewed", { saved_count: 2 });
  });

  // jsdom has no layout: rod "a" is the band y 0–300, rod "b" y 300–600, and each rod's slots sit 100 px apart (centres 50, 150, …)
  const layout = () => vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
    const el = this as HTMLElement;
    if (el.dataset.rod) return box(0, el.dataset.rod === "a" ? 0 : 300, 400, 300);
    const slot = el.closest<HTMLElement>("li[data-slot], li[aria-hidden]");
    if (slot) return box(Array.from(slot.parentElement!.children).indexOf(slot) * 100, 0, 100, 200);
    return box(0, 0, 0, 0);
  });
  const lift = async (name: string) => {
    const el = await screen.findByRole("button", { name });
    fireEvent.pointerDown(el, { clientX: 50, clientY: 100 });
    act(() => { vi.advanceTimersByTime(500); });
    return el;
  };
  const dragTo = (x: number, y: number) => { act(() => { fireEvent.pointerMove(window, { clientX: x, clientY: y }); }); };

  it("hold, drag onto another rod and let go: a gap opens there, it moves to that place (E-30 drag)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    layout();
    await mount(IN);
    const moso = await lift("모순 책갈피");
    expect(screen.getByRole("status")).toHaveTextContent("놓을 자리로 끌어서 놓으세요");
    expect(moso).toHaveAttribute("data-lifted");
    dragTo(150, 450);
    expect(screen.queryByText("아직 비어 있어요")).toBeNull();                        // the empty rod shows the gap instead
    expect(document.querySelectorAll('[data-rod="b"] li')).toHaveLength(1);
    request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok(VIEW));
    act(() => { fireEvent.pointerUp(window); });
    await waitFor(() => expect(request).toHaveBeenCalledWith("PATCH", "/api/library/saves", { isbn: "9788998441012", shelfId: "b", index: 0 }));
    expect(track).toHaveBeenCalledWith("bookmark_moved", { book_id: "9788998441012", method: "drag", is_same_shelf: false });
    expect(await screen.findByText("으로 옮겼어요", { exact: false })).toBeInTheDocument();
    fireEvent.click(moso);                                                              // the click after the drag is not a tap
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reorders within a rod (is_same_shelf), and the gap stays shut over its own place", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    layout();
    await mount(IN);
    await lift("모순 책갈피");
    dragTo(60, 100);                                                                    // its own place: no gap
    expect(document.querySelectorAll('[data-rod="a"] li')).toHaveLength(2);
    dragTo(260, 100);                                                                   // past 데미안's centre
    expect(document.querySelectorAll('[data-rod="a"] li')).toHaveLength(3);
    request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok(VIEW));
    act(() => { fireEvent.pointerUp(window); });
    await waitFor(() => expect(request).toHaveBeenCalledWith("PATCH", "/api/library/saves", { isbn: "9788998441012", shelfId: "a", index: 1 }));
    expect(track).toHaveBeenCalledWith("bookmark_moved", { book_id: "9788998441012", method: "drag", is_same_shelf: true });
  });

  it("let go outside the rods, on its own place, with Escape or a cancelled pointer: nothing moves, no event", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    layout();
    await mount(IN);
    const calls = request.mock.calls.length;
    for (const end of [
      () => { dragTo(150, 900); fireEvent.pointerUp(window); },
      () => { dragTo(40, 120); fireEvent.pointerUp(window); },
      () => { dragTo(150, 450); fireEvent.keyDown(window, { key: "Escape" }); },
      () => { dragTo(150, 450); fireEvent.pointerCancel(window); },
    ]) {
      const moso = await lift("모순 책갈피");
      act(end);
      expect(moso).not.toHaveAttribute("data-lifted");
      expect(screen.queryByText("놓을 자리로 끌어서 놓으세요")).toBeNull();
    }
    expect(request.mock.calls.length).toBe(calls);
    expect(track).not.toHaveBeenCalledWith("bookmark_moved", expect.anything());
  });

  it("a touch drag never pans the page; the listener goes when the drag ends", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    layout();
    await mount(IN);
    await lift("모순 책갈피");
    const pan = new Event("touchmove", { bubbles: true, cancelable: true });
    document.dispatchEvent(pan);
    expect(pan.defaultPrevented).toBe(true);
    act(() => { fireEvent.pointerUp(window); });
    const after = new Event("touchmove", { bubbles: true, cancelable: true });
    document.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it("a tap opens the bookmark's front, large, with the day it was met; YES24 (E-18 library) and the menu move (E-30 menu)", async () => {
    await mount(IN);
    fireEvent.click(await screen.findByRole("button", { name: "모순 책갈피" }));
    const sheet = screen.getByRole("dialog", { name: "모순" });
    expect(within(sheet).getByText("2026. 10. 1. 만남")).toBeInTheDocument();
    expect(within(sheet).queryByText("나온 이유")).toBeNull();                         // no back face in 내 책갈피 (10-04)
    expect(within(sheet).queryByText("만난 날")).toBeNull();
    fireEvent.click(within(sheet).getByRole("link", { name: /예스24에서 보기/ }));
    expect(track).toHaveBeenCalledWith("yes24_link_clicked", { book_id: "9788998441012", source: "library", pick_type: null });
    fireEvent.click(within(sheet).getByRole("button", { name: "다른 막대로 옮기기" }));
    const picker = screen.getByRole("dialog", { name: "어느 막대로 옮길까요?" });
    expect(within(picker).getByRole("button", { name: /읽을 책 \(지금\)/ })).toBeDisabled();
    request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok(VIEW));
    fireEvent.click(within(picker).getByRole("button", { name: "마음에 남은" }));
    await waitFor(() => expect(track).toHaveBeenCalledWith("bookmark_moved", { book_id: "9788998441012", method: "menu", is_same_shelf: false }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("[빼기] asks once more, then removes (E-16)", async () => {
    await mount(IN);
    fireEvent.click(await screen.findByRole("button", { name: "데미안 책갈피" }));
    fireEvent.click(screen.getByRole("button", { name: "빼기" }));
    expect(screen.getByText(/이 책갈피를 뺄까요\?/)).toBeInTheDocument();
    request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok(VIEW));
    fireEvent.click(screen.getByRole("button", { name: "빼기" }));
    await waitFor(() => expect(track).toHaveBeenCalledWith("book_unsaved", { book_id: "9788937460449" }));
  });

  it("adds a rod with a name (E-29), renames a rod, and clears an empty one", async () => {
    await mount(IN);
    fireEvent.click(await screen.findByRole("button", { name: "＋ 막대 추가" }));
    const input = screen.getByRole("textbox", { name: "새 막대 이름" });
    expect(input).toHaveAttribute("data-amp-mask");
    expect(input).toHaveAttribute("maxlength", "12");
    fireEvent.change(input, { target: { value: "밤에 읽기" } });
    request.mockResolvedValueOnce(ok({ ok: true, shelf: { id: "c", name: "밤에 읽기", position: 2 } })).mockResolvedValueOnce(ok(VIEW));
    fireEvent.click(screen.getByRole("button", { name: "만들기" }));
    await waitFor(() => expect(track).toHaveBeenCalledWith("shelf_created", { shelf_count: 3 }));

    fireEvent.click(screen.getAllByRole("button", { name: "막대 이름 고치기" })[1]);
    fireEvent.change(screen.getByRole("textbox", { name: "막대 이름" }), { target: { value: "다시 읽기" } });
    request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok(VIEW));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("PATCH", "/api/library/shelves", { id: "b", name: "다시 읽기" }));

    request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok(VIEW));
    fireEvent.click(await screen.findByRole("button", { name: "막대 치우기" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("DELETE", "/api/library/shelves", { id: "b" }));
  });

  it("logs out of this browser: Amplitude forgets the person, then the start page", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    logout.mockResolvedValue(true);
    await mount(IN);
    fireEvent.click(await screen.findByRole("button", { name: "로그아웃" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
    expect(setAmplitudeUser).toHaveBeenCalledWith(null);
  });
});
