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
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); vi.useRealTimers(); });

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

  it("hold a bookmark, then tap another rod: it moves there (E-30 hold) and says where", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await mount(IN);
    const moso = await screen.findByRole("button", { name: "모순 책갈피" });
    fireEvent.pointerDown(moso, { clientX: 5, clientY: 5 });
    act(() => { vi.advanceTimersByTime(500); });
    fireEvent.pointerUp(moso);
    expect(moso).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("책갈피를 들었어요");
    request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok(VIEW));
    fireEvent.click(screen.getByRole("button", { name: "여기를 누르면 옮겨져요" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("PATCH", "/api/library/saves", { isbn: "9788998441012", shelfId: "b" }));
    expect(track).toHaveBeenCalledWith("bookmark_moved", { book_id: "9788998441012", method: "hold" });
    expect(await screen.findByText("으로 옮겼어요", { exact: false })).toBeInTheDocument();
  });

  it("a held bookmark goes back down on [취소] or a tap on it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await mount(IN);
    const moso = await screen.findByRole("button", { name: "모순 책갈피" });
    fireEvent.pointerDown(moso, { clientX: 5, clientY: 5 });
    act(() => { vi.advanceTimersByTime(500); });
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "취소" }));
    expect(moso).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "여기를 누르면 옮겨져요" })).toBeNull();
  });

  it("a tap turns the bookmark over: its back, YES24 (E-18 library), and moving through the menu (E-30 menu)", async () => {
    await mount(IN);
    fireEvent.click(await screen.findByRole("button", { name: "모순 책갈피" }));
    const sheet = screen.getByRole("dialog", { name: "모순" });
    expect(within(sheet).getByText("만난 날")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("link", { name: /예스24에서 보기/ }));
    expect(track).toHaveBeenCalledWith("yes24_link_clicked", { book_id: "9788998441012", source: "library", pick_type: null });
    fireEvent.click(within(sheet).getByRole("button", { name: "다른 막대로 옮기기" }));
    const picker = screen.getByRole("dialog", { name: "어느 막대로 옮길까요?" });
    expect(within(picker).getByRole("button", { name: /읽을 책 \(지금\)/ })).toBeDisabled();
    request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok(VIEW));
    fireEvent.click(within(picker).getByRole("button", { name: "마음에 남은" }));
    await waitFor(() => expect(track).toHaveBeenCalledWith("bookmark_moved", { book_id: "9788998441012", method: "menu" }));
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
