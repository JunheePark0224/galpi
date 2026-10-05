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

  it("logged out: the 도감 in silhouettes and the login instead of the rods (도감 v1 시안 ②, E-37)", async () => {
    const store = await mount({ enabled: true, loggedIn: false, id: null, count: 0 });
    expect(screen.getByRole("heading", { level: 1, name: "도감" })).toBeInTheDocument();
    expect(screen.getByText("로그인하면 만난 책갈피가 도감에 모여요")).toBeInTheDocument();
    expect(screen.getByText("동물 0 / 16 · 배경 0 / 11 · 소품 0 / 15")).toBeInTheDocument();
    expect(screen.getAllByText("아직 만나지 않은 동물")).toHaveLength(16);
    expect(screen.queryByRole("group", { name: "내 책갈피 보기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "로그인하고 모으기" }));
    expect(store.loginSheetSnapshot()).toEqual({ source: "header" });
    expect(request).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("collection_viewed", { collected_count: 0, is_logged_in: false });
  });

  it("logged out with bookmarks kept in this browser: 내 책갈피 with the note, the rod to look at, 빼기 — then the 도감 (v1.7)", async () => {
    localStorage.setItem("galpi.guestSaves", JSON.stringify({ v: 1, items: [bm("9788998441012", "모순"), bm("9788937460449", "데미안")] }));
    const store = await mount({ enabled: true, loggedIn: false, id: null, count: 0 });
    expect(screen.getByRole("heading", { level: 1, name: "내 책갈피" })).toBeInTheDocument();
    expect(screen.getByText("지금은 이 브라우저에만 저장돼 있어요")).toBeInTheDocument();
    expect(screen.getByText("로그인하면 사라지지 않고 휴대폰·PC 어디서나 이어져요. 막대로 정리하고, 도감을 모으고, 책갈피를 꾸밀 수도 있어요.")).toBeInTheDocument();
    expect(screen.getByText("브라우저 기록을 지우면 임시 책갈피도 사라져요")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "도감" })).toBeInTheDocument();
    expect(screen.getByText("동물 0 / 16 · 배경 0 / 11 · 소품 0 / 15")).toBeInTheDocument();
    // the first rod, newest first — no renaming, moving, clearing or adding rods before a login
    const rod = screen.getByRole("list", { name: "첫 막대" });
    expect(within(rod).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["모순 책갈피", "데미안 책갈피"]);
    for (const name of ["막대 이름 고치기", "책갈피 옮기기", "모두 제거", "＋ 막대 추가", "로그아웃"]) expect(screen.queryByRole("button", { name })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "로그인하고 지키기" }));
    expect(store.loginSheetSnapshot()).toEqual({ source: "library" });
    act(() => store.closeLoginSheet());

    // the front, large: YES24 and 빼기 only
    fireEvent.click(screen.getByRole("button", { name: "모순 책갈피" }));
    const sheet = screen.getByRole("dialog", { name: "모순" });
    expect(within(sheet).getByRole("link", { name: /예스24에서 보기/ })).toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: /꾸미기|옮기기/ })).toBeNull();
    fireEvent.click(within(sheet).getByRole("button", { name: "빼기" }));
    await act(async () => { fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "빼기" })); });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "모순 책갈피" })).toBeNull();
    expect(track).toHaveBeenCalledWith("book_unsaved", { book_id: "9788998441012" });
    expect(request).not.toHaveBeenCalled();

    // the last one out: the logged-out page as before
    fireEvent.click(screen.getByRole("button", { name: "데미안 책갈피" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "빼기" }));
    await act(async () => { fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "빼기" })); });
    expect(screen.getByRole("heading", { level: 1, name: "도감" })).toBeInTheDocument();
    expect(localStorage.getItem("galpi.guestSaves")).toBeNull();
  });

  it("[막대 | 도감] switches between the rods and the 도감 (도감 v1 시안 ①)", async () => {
    const OTTER = { kind: "animal", value: "otter", firstMetAt: "2026-10-05T00:00:00Z", firstArt: { animal: "otter", bg: "peach", sky: "moon", ground: "none", rare: true }, isNew: true };
    request.mockImplementation(async (_m: string, path: string) => (path === "/api/collection" ? ok({ items: [OTTER] }) : ok(VIEW)));
    await mount(IN);
    const rods = await screen.findByRole("button", { name: "막대" });
    expect(rods).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "도감" }));
    expect(screen.getByRole("button", { name: "도감" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("동물 1 / 16 · 배경 0 / 11 · 소품 0 / 15")).toBeInTheDocument();
    expect(screen.getByText("수달")).toBeInTheDocument();
    expect(screen.queryByText("2개 · 동물 1종")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "막대" }));
    expect(await screen.findByText("2개 · 동물 1종")).toBeInTheDocument();
  });

  it("hides the switch in move mode", async () => {
    await mount(IN);
    fireEvent.click(await screen.findByRole("button", { name: "책갈피 옮기기" }));
    expect(screen.queryByRole("group", { name: "내 책갈피 보기" })).toBeNull();
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
  const enterMode = async () => { fireEvent.click(await screen.findByRole("button", { name: "책갈피 옮기기" })); };
  /** Move mode: press and move 6 px — picked up at once, no hold. */
  const lift = async (name: string, pointerId?: number) => {
    const el = await screen.findByRole("button", { name });
    fireEvent.pointerDown(el, { clientX: 50, clientY: 100, pointerId });
    act(() => { fireEvent.pointerMove(window, { clientX: 56, clientY: 100, pointerId }); });
    return el;
  };
  const dragTo = (x: number, y: number) => { act(() => { fireEvent.pointerMove(window, { clientX: x, clientY: y }); }); };

  it("[책갈피 옮기기] turns move mode on: [완료] (ink), the hint, [모두 제거] and the rod buttons step aside; [완료] and Escape turn it off", async () => {
    await mount(IN);
    const toggle = await screen.findByRole("button", { name: "책갈피 옮기기" });
    expect(toggle).not.toHaveAttribute("data-moving");
    expect(toggle.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "모두 제거" })).toBeInTheDocument();
    expect(screen.queryByText("책갈피를 끌어서 원하는 자리에 놓으세요")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent("완료");
    expect(toggle).toHaveAttribute("data-moving");
    expect(screen.queryByRole("button", { name: "모두 제거" })).toBeNull();
    expect(screen.getByText("책갈피를 끌어서 원하는 자리에 놓으세요")).toBeInTheDocument();
    expect(document.querySelector("[data-move-mode]")).not.toBeNull();
    for (const name of ["막대 이름 고치기", "막대 치우기", "＋ 막대 추가"]) expect(screen.queryByRole("button", { name })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "완료" }));
    expect(screen.getByRole("button", { name: "책갈피 옮기기" })).toBeInTheDocument();
    expect(screen.queryByText("책갈피를 끌어서 원하는 자리에 놓으세요")).toBeNull();
    expect(screen.getAllByRole("button", { name: "막대 이름 고치기" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "＋ 막대 추가" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "모두 제거" })).toBeInTheDocument();
    await enterMode();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "책갈피 옮기기" })).toBeInTheDocument();
    expect(document.querySelector("[data-move-mode]")).toBeNull();
  });

  it("no bookmarks: no [책갈피 옮기기] and no [모두 제거]", async () => {
    request.mockResolvedValue(ok({ count: 0, animals: 0, shelves: [{ ...VIEW.shelves[0], bookmarks: [] }] }));
    await mount({ ...IN, count: 0 });
    expect(await screen.findByText("0개 · 동물 0종")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "책갈피 옮기기" })).toBeNull();
    expect(screen.queryByRole("button", { name: "모두 제거" })).toBeNull();
  });

  const EMPTY: LibraryView = { count: 0, animals: 0, shelves: VIEW.shelves.map((s) => ({ ...s, bookmarks: [] })) };
  const clearSheet = () => screen.getByRole("dialog", { name: "책갈피 2개를 모두 뺄까요?" });

  it("[모두 제거] asks once more; [그대로 두기] closes the sheet and sends nothing", async () => {
    await mount(IN);
    fireEvent.click(await screen.findByRole("button", { name: "모두 제거" }));
    const sheet = clearSheet();
    expect(within(sheet).getByText(/빼면 되돌릴 수 없어요\. 다시 꽂으려면 책을 다시 만나야 해요\./)).toBeInTheDocument();
    expect(within(sheet).getByText(/막대와 막대 이름은 그대로 남아요\./)).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "모두 빼기" })).toHaveFocus();
    const calls = request.mock.calls.length;
    fireEvent.click(within(sheet).getByRole("button", { name: "그대로 두기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(request.mock.calls.length).toBe(calls);
    expect(screen.getByRole("button", { name: "모순 책갈피" })).toBeInTheDocument();
    expect(track).not.toHaveBeenCalledWith("library_cleared", expect.anything());
  });

  it("[모두 빼기] waits for the server, then the rods stay empty, the header count is 0 and E-35 goes (no E-16)", async () => {
    const store = await mount(IN);
    fireEvent.click(await screen.findByRole("button", { name: "모두 제거" }));
    let answer!: (v: unknown) => void;
    request.mockImplementationOnce(() => new Promise((r) => { answer = r; })).mockResolvedValueOnce(ok(EMPTY));
    fireEvent.click(within(clearSheet()).getByRole("button", { name: "모두 빼기" }));
    expect(request).toHaveBeenLastCalledWith("DELETE", "/api/library/saves/all", { all: true });
    // not before the server says yes: the bookmarks are still there, and the button is held
    expect(screen.getByRole("button", { name: "모순 책갈피" })).toBeInTheDocument();
    expect(within(clearSheet()).getByRole("button", { name: "모두 빼기" })).toBeDisabled();
    await act(async () => { answer(ok({ ok: true, removed: 2 })); });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("0개 · 동물 0종")).toBeInTheDocument();
    expect(screen.getAllByText("아직 비어 있어요")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "읽을 책" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "모두 제거" })).toBeNull();
    expect(store.accountSnapshot().count).toBe(0);
    expect(track).toHaveBeenCalledWith("library_cleared", { removed_count: 2 });
    expect(track).not.toHaveBeenCalledWith("book_unsaved", expect.anything());
    expect(request).toHaveBeenLastCalledWith("GET", "/api/library");
    expect(screen.getByRole("heading", { level: 1, name: "내 책갈피" })).toHaveFocus();   // not lost on the body
  });

  it("[모두 빼기] pressed twice quickly sends once", async () => {
    await mount(IN);
    fireEvent.click(await screen.findByRole("button", { name: "모두 제거" }));
    let answer!: (v: unknown) => void;
    request.mockImplementationOnce(() => new Promise((r) => { answer = r; })).mockResolvedValueOnce(ok(EMPTY));
    const button = within(clearSheet()).getByRole("button", { name: "모두 빼기" });
    const before = request.mock.calls.length;
    fireEvent.click(button);
    fireEvent.click(button);
    expect(request.mock.calls.length).toBe(before + 1);
    await act(async () => { answer(ok({ ok: true, removed: 2 })); });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(track.mock.calls.filter(([name]) => name === "library_cleared")).toHaveLength(1);
  });

  it("[모두 빼기] refused: the sheet stays with the reason, nothing changes, no event — and it can be tried again", async () => {
    const store = await mount(IN);
    fireEvent.click(await screen.findByRole("button", { name: "모두 제거" }));
    request.mockResolvedValueOnce({ ok: false, status: 500, body: null });
    fireEvent.click(within(clearSheet()).getByRole("button", { name: "모두 빼기" }));
    expect(await within(clearSheet()).findByRole("alert")).toHaveTextContent("모두 빼지 못했어요. 다시 해 주세요.");
    expect(screen.getByRole("button", { name: "모순 책갈피" })).toBeInTheDocument();
    expect(store.accountSnapshot().count).toBe(2);
    expect(track).not.toHaveBeenCalledWith("library_cleared", expect.anything());
    // a body without a number still counts what was drawn
    request.mockResolvedValueOnce(ok({ ok: true })).mockResolvedValueOnce(ok(EMPTY));
    fireEvent.click(within(clearSheet()).getByRole("button", { name: "모두 빼기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(track).toHaveBeenCalledWith("library_cleared", { removed_count: 2 });
  });

  it("outside move mode a press that moves (or is held) never drags — a tap opens the sheet", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    layout();
    await mount(IN);
    const moso = await lift("모순 책갈피");
    act(() => { vi.advanceTimersByTime(800); });
    dragTo(150, 450);
    expect(moso).not.toHaveAttribute("data-lifted");
    expect(screen.queryByText("놓을 자리로 끌어서 놓으세요")).toBeNull();
    fireEvent.pointerUp(window);
    fireEvent.click(moso);
    expect(screen.getByRole("dialog", { name: "모순" })).toBeInTheDocument();
  });

  it("in move mode a tap does nothing and a move under 4 px is still a tap; a keyboard press still opens the sheet", async () => {
    layout();
    await mount(IN);
    await enterMode();
    const moso = await screen.findByRole("button", { name: "모순 책갈피" });
    fireEvent.pointerDown(moso, { clientX: 50, clientY: 100 });
    act(() => { fireEvent.pointerMove(window, { clientX: 53, clientY: 101 }); });
    expect(moso).not.toHaveAttribute("data-lifted");
    fireEvent.pointerUp(window);
    fireEvent.click(moso, { detail: 1 });
    expect(screen.queryByRole("dialog")).toBeNull();
    dragTo(150, 450);                                                                   // released: later moves do nothing
    expect(moso).not.toHaveAttribute("data-lifted");
    fireEvent.pointerDown(moso, { clientX: 50, clientY: 100, button: 2, pointerType: "mouse" });   // not the main button
    dragTo(150, 450);
    expect(moso).not.toHaveAttribute("data-lifted");
    const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    moso.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);                                          // no long-press menu in move mode
    fireEvent.click(moso, { detail: 0 });                                              // Enter / Space
    expect(screen.getByRole("dialog", { name: "모순" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });                                       // the sheet's Escape, not the mode's
    expect(screen.getByRole("button", { name: "완료" })).toBeInTheDocument();
  });

  it("move mode: drag onto another rod and let go — a gap opens there, it moves to that place (E-30 drag), no success toast", async () => {
    layout();
    await mount(IN);
    await enterMode();
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
    await waitFor(() => expect(request).toHaveBeenLastCalledWith("GET", "/api/library"));
    expect(screen.queryByRole("status")).toBeNull();                                     // a move that worked says nothing
    expect(screen.queryByText(/옮겼어요/)).toBeNull();
    fireEvent.click(moso);                                                              // the click after the drag is not a tap
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "완료" })).toBeInTheDocument();          // still in move mode
  });

  it("reorders within a rod (is_same_shelf), and the gap stays shut over its own place", async () => {
    layout();
    await mount(IN);
    await enterMode();
    await lift("모순 책갈피");
    dragTo(60, 100);                                                                    // its own place: no gap
    expect(document.querySelectorAll('[data-rod="a"] li')).toHaveLength(2);
    dragTo(260, 100);                                                                   // past 데미안's centre
    expect(document.querySelectorAll('[data-rod="a"] li')).toHaveLength(3);
    request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok(VIEW));
    act(() => { fireEvent.pointerUp(window); });
    await waitFor(() => expect(request).toHaveBeenCalledWith("PATCH", "/api/library/saves", { isbn: "9788998441012", shelfId: "a", index: 1 }));
    expect(track).toHaveBeenCalledWith("bookmark_moved", { book_id: "9788998441012", method: "drag", is_same_shelf: true });
    await waitFor(() => expect(request).toHaveBeenLastCalledWith("GET", "/api/library"));        // the quiet re-read
    expect(screen.queryByRole("status")).toBeNull();                                         // a reorder says nothing
  });

  it("let go outside the rods, on its own place, with Escape or a cancelled pointer: nothing moves, no event, still in move mode", async () => {
    layout();
    await mount(IN);
    await enterMode();
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
      expect(screen.getByRole("button", { name: "완료" })).toBeInTheDocument();       // Escape mid-drag only puts it back
    }
    expect(request.mock.calls.length).toBe(calls);
    expect(track).not.toHaveBeenCalledWith("bookmark_moved", expect.anything());
  });

  it("a drag the server refuses goes back where it was, says so, and the rods are read again", async () => {
    layout();
    await mount(IN);
    await enterMode();
    await lift("모순 책갈피");
    dragTo(150, 450);
    request.mockResolvedValueOnce({ ok: false, status: 500, body: null }).mockResolvedValueOnce(ok(VIEW));
    act(() => { fireEvent.pointerUp(window); });
    expect(await screen.findByText("옮기지 못했어요. 다시 해 주세요.")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "읽을 책" })).toContainElement(screen.getByRole("button", { name: "모순 책갈피" }));
    await waitFor(() => expect(request).toHaveBeenLastCalledWith("GET", "/api/library"));
    expect(track).not.toHaveBeenCalledWith("bookmark_moved", expect.anything());
  });

  it("blocks touch panning only while dragging, with a touchmove listener there from the start (cancelable from touchstart)", async () => {
    layout();
    const add = vi.spyOn(document, "addEventListener");
    await mount(IN);
    expect(add).toHaveBeenCalledWith("touchmove", expect.any(Function), { passive: false });   // before any drag
    const touch = (cancelable = true) => {
      const e = new Event("touchmove", { bubbles: true, cancelable });
      document.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(touch()).toBe(false);                                                 // a plain scroll stays a scroll
    await enterMode();
    expect(touch()).toBe(false);                                                 // move mode alone blocks nothing
    await lift("모순 책갈피");
    expect(add.mock.calls.filter(([type]) => type === "touchmove")).toHaveLength(1);   // not added again mid-touch
    expect(touch()).toBe(true);
    expect(touch(false)).toBe(false);
    act(() => { fireEvent.pointerUp(window); });
    expect(touch()).toBe(false);
  });

  it("follows only the finger that picked it up: another pointer's moves, release and pick-up are ignored", async () => {
    layout();
    await mount(IN);
    await enterMode();
    const moso = await lift("모순 책갈피", 3);
    const demian = await lift("데미안 책갈피", 4);                                  // a second finger cannot start another drag
    expect(demian).not.toHaveAttribute("data-lifted");
    act(() => { fireEvent.pointerMove(window, { clientX: 150, clientY: 450, pointerId: 4 }); });
    expect(document.querySelectorAll('[data-rod="b"] li')).toHaveLength(0);       // no gap from the other finger
    act(() => { fireEvent.pointerUp(window, { pointerId: 4 }); });
    expect(moso).toHaveAttribute("data-lifted");                                 // still dragging
    act(() => { fireEvent.pointerMove(window, { clientX: 150, clientY: 450, pointerId: 3 }); });
    expect(document.querySelectorAll('[data-rod="b"] li')).toHaveLength(1);
    act(() => { fireEvent.pointerCancel(window, { pointerId: 3 }); });
    expect(moso).not.toHaveAttribute("data-lifted");
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
    expect(screen.queryByText(/옮겼어요/)).toBeNull();                                  // no success toast (user, 10-04)
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
