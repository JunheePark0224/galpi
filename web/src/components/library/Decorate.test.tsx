import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtCombo } from "@/lib/art/combine";
import { libraryGuide } from "@/lib/flow/firstGuide";
import type { LibraryBookmark, LibraryShelf, LibraryView } from "@/lib/library/types";

const track = vi.fn();
const request = vi.fn();
vi.mock("@/lib/track/client", () => ({ track: (...a: unknown[]) => track(...a) }));
vi.mock("@/lib/library/client", () => ({ libraryRequest: (...a: unknown[]) => request(...a) }));
vi.mock("@/lib/auth/browser", () => ({ logout: vi.fn() }));
vi.mock("@/lib/track/amplitude", () => ({ setAmplitudeUser: vi.fn() }));

import { BookmarkSheet } from "./BookmarkSheet";

const FIRST: ArtCombo = { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false };
const card = { id: "9788998441012", entry: "leaf" as const, title: "물고기는 존재하지 않는다", author: "룰루 밀러", genre: "에세이", field: null, oneLiner: "?", oneLinerStyle: "question" as const };
const bookmark = (art: ArtCombo = FIRST, originalArt: ArtCombo | null = FIRST): LibraryBookmark =>
  ({ isbn: card.id, art, originalArt, reason: { label: "나온 이유", items: [] }, metOn: "2026-10-04", card });
const rod = (id: string, name: string, bookmarks: LibraryBookmark[] = []): LibraryShelf => ({ id, name, position: id === "a" ? 0 : 1, bookmarks });
const ok = (body: unknown = { ok: true }) => ({ ok: true, status: 200, body });
const item = (kind: string, value: string) => ({ kind, value, firstMetAt: "2026-10-05T00:00:00Z", firstArt: { ...FIRST, [kind]: value }, isNew: false });
/** The person's 도감: 레서판다 (한정판), 수달 (한정판), 여우 (일반판), 은하수 (초판본 배경). */
const DEX = [item("animal", "redpanda"), item("animal", "otter"), item("animal", "fox"), item("bg", "galaxy")];

function sheet(props: Partial<Parameters<typeof BookmarkSheet>[0]> = {}) {
  const onDecorate = vi.fn().mockResolvedValue(true);
  const utils = render(
    <BookmarkSheet
      bookmark={bookmark()} shelfId="a" shelves={[rod("a", "첫 막대"), rod("b", "둘째")]}
      onMove={vi.fn()} onRemove={vi.fn()} onDecorate={onDecorate} onClose={vi.fn()} {...props}
    />,
  );
  return { ...utils, onDecorate };
}

describe("BookmarkSheet — 시안 C buttons (10-05)", () => {
  beforeEach(() => { request.mockReset(); request.mockResolvedValue(ok({ items: DEX })); });
  afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

  it("two rods: [예스24에서 보기] alone on top, then [꾸미기] [옮기기] side by side, then a small [빼기]", () => {
    sheet();
    const dialog = screen.getByRole("dialog", { name: card.title });
    const buttons = within(dialog).getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent);
    expect(buttons).toEqual(["책갈피 꾸미기", "다른 막대로 옮기기", "빼기"]);
    const decorate = within(dialog).getByRole("button", { name: "책갈피 꾸미기" });
    expect(decorate).toHaveTextContent("🎨꾸미기");
    expect(within(dialog).getByRole("button", { name: "다른 막대로 옮기기" })).toHaveTextContent("↔옮기기");
    expect(decorate.parentElement).toBe(within(dialog).getByRole("button", { name: "다른 막대로 옮기기" }).parentElement);
    expect(within(dialog).getByRole("link", { name: /예스24에서 보기/ })).toHaveAttribute("data-variant", "primary");
  });

  it("one rod: no [옮기기] — [꾸미기] takes the row alone", () => {
    sheet({ shelves: [rod("a", "첫 막대")] });
    const decorate = screen.getByRole("button", { name: "책갈피 꾸미기" });
    expect(screen.queryByRole("button", { name: "다른 막대로 옮기기" })).toBeNull();
    expect(decorate.parentElement?.children).toHaveLength(1);
  });

  it("before 0005 (first picture unknown): no [꾸미기]; with one rod the row is gone", () => {
    const { unmount } = sheet({ bookmark: bookmark(FIRST, null) });
    expect(screen.queryByRole("button", { name: "책갈피 꾸미기" })).toBeNull();
    expect(screen.getByRole("button", { name: "다른 막대로 옮기기" })).toBeInTheDocument();
    unmount();
    sheet({ bookmark: bookmark(FIRST, null), shelves: [rod("a", "첫 막대")] });
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["빼기"]);
  });
});

describe("C-26 책갈피 꾸미기 editor", () => {
  beforeEach(() => { request.mockReset(); request.mockResolvedValue(ok({ items: DEX })); });
  afterEach(() => { vi.clearAllMocks(); });

  async function openEditor(props: Partial<Parameters<typeof BookmarkSheet>[0]> = {}) {
    const utils = sheet(props);
    fireEvent.click(screen.getByRole("button", { name: "책갈피 꾸미기" }));
    await screen.findByRole("region", { name: "동물 한정판" });
    return utils;
  }

  it("keeps the preview and the tabs pinned above the one scrolling list of parts; the footer below it (10-07)", async () => {
    await openEditor();
    const dialog = screen.getByRole("dialog", { name: "책갈피 꾸미기" });
    expect(dialog).toHaveAttribute("data-pinned");
    const list = dialog.querySelector<HTMLElement>("[data-parts]")!;
    expect(list).not.toBeNull();
    expect(within(list).getByRole("region", { name: "동물 한정판" })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "뒤로" })).toBeInTheDocument();
    for (const outside of [within(dialog).getByRole("group", { name: "꾸밀 부분" }), within(dialog).getByRole("button", { name: "이대로 꽂기" })]) {
      expect(list.contains(outside)).toBe(false);
    }
    expect(list.contains(dialog.querySelector("svg"))).toBe(false);                 // the preview is not in the list
    // a new tab starts its list at the top
    list.scrollTop = 120;
    fireEvent.click(within(dialog).getByRole("button", { name: "배경" }));
    expect(list.scrollTop).toBe(0);
  });

  it("focus moves into the editor; tabs are buttons with aria-pressed; cells are named by part and tier, or 잠김", async () => {
    await openEditor();
    expect(screen.getByRole("dialog", { name: "책갈피 꾸미기" })).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("GET", "/api/collection");
    const animal = screen.getByRole("button", { name: "동물" });
    expect(animal).toHaveFocus();
    expect(animal).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "여우, 일반판" })).toHaveAttribute("aria-pressed", "true");    // the current one
    expect(screen.getByRole("button", { name: "레서판다, 한정판" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "청룡, 잠김" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "고양이, 잠김" })).toBeDisabled();
    // each picked cell draws its own animal (on the draft's background)
    expect(screen.getByRole("button", { name: "레서판다, 한정판" }).querySelector("image")?.getAttribute("href")).toBe("/animals/redpanda.svg");
    expect(screen.getByRole("button", { name: "수달, 한정판" }).querySelector("image")?.getAttribute("href")).toBe("/animals/otter.svg");
    expect(screen.getByRole("heading", { name: "초판본" })).toHaveAttribute("data-tier", "first_edition");
    // nothing changed yet: nothing to save or reset
    expect(screen.getByRole("button", { name: "이대로 꽂기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "처음 그림으로" })).toBeDisabled();
  });

  it("땅 소품 '없음' is always there to pick, and the bookmark's own first parts too (even outside the 도감)", async () => {
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "땅 소품" }));
    expect(screen.getByRole("button", { name: "없음, 일반판" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "책 더미, 일반판" })).toHaveAttribute("aria-pressed", "true");   // first picture's
    expect(screen.getByRole("button", { name: "풀, 잠김" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "하늘 소품" }));
    expect(screen.getByRole("button", { name: "달, 일반판" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "배경" }));
    expect(screen.getByRole("button", { name: "은하수, 초판본" })).toBeEnabled();
  });

  it("a pick shows in the preview; [이대로 꽂기] sends it; then the front, the note and focus on [꾸미기]", async () => {
    const { onDecorate } = await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "레서판다, 한정판" }));
    expect(screen.getByRole("button", { name: "레서판다, 한정판" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "여우, 일반판" })).toHaveAttribute("aria-pressed", "false");
    const preview = document.querySelector('[data-part="title"]')!.closest("article")!;
    expect(preview.querySelector("image")?.getAttribute("href")).toBe("/animals/redpanda.svg");
    fireEvent.click(screen.getByRole("button", { name: "배경" }));
    fireEvent.click(screen.getByRole("button", { name: "은하수, 초판본" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이대로 꽂기" })); });
    expect(onDecorate).toHaveBeenCalledWith({ ...FIRST, animal: "redpanda", bg: "galaxy", rare: true });
    expect(screen.getByRole("dialog", { name: card.title })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("새 그림으로 꽂았어요");
    expect(screen.getByRole("button", { name: "책갈피 꾸미기" })).toHaveFocus();
  });

  it("[처음 그림으로] puts the first picture back in the preview (sent with [이대로 꽂기])", async () => {
    const decorated = { ...FIRST, animal: "otter" as const, rare: true };
    const { onDecorate } = await openEditor({ bookmark: bookmark(decorated, FIRST) });
    expect(screen.getByRole("button", { name: "수달, 한정판" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "처음 그림으로" }));
    expect(screen.getByRole("button", { name: "여우, 일반판" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "처음 그림으로" })).toBeDisabled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이대로 꽂기" })); });
    expect(onDecorate).toHaveBeenCalledWith(FIRST);
  });

  it("a refused save keeps the editor open and says so", async () => {
    const onDecorate = vi.fn().mockResolvedValue(false);
    await openEditor({ onDecorate });
    fireEvent.click(screen.getByRole("button", { name: "수달, 한정판" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이대로 꽂기" })); });
    expect(screen.getByRole("dialog", { name: "책갈피 꾸미기" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("꽂지 못했어요. 다시 해 주세요.");
  });

  it("the 도감 not loading: '도감을 불러오지 못했어요', every cell locked, nothing can be saved", async () => {
    request.mockResolvedValue({ ok: false, status: 503, body: { error: "collection is not ready" } });
    sheet();
    fireEvent.click(screen.getByRole("button", { name: "책갈피 꾸미기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("도감을 불러오지 못했어요");
    expect(screen.getByRole("button", { name: "여우, 잠김" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "이대로 꽂기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "처음 그림으로" })).toBeDisabled();
  });

  it("[뒤로] and Escape go back to the front with focus on [꾸미기], nothing saved", async () => {
    const { onDecorate } = await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "뒤로" }));
    expect(screen.getByRole("button", { name: "책갈피 꾸미기" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "책갈피 꾸미기" }));
    await screen.findByRole("region", { name: "동물 한정판" });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog", { name: card.title })).toBeInTheDocument();
    expect(onDecorate).not.toHaveBeenCalled();
  });
});

describe("Library — 꾸미기 end to end in the page (E-38)", () => {
  const VIEW: LibraryView = { count: 1, animals: 1, shelves: [rod("a", "첫 막대", [bookmark()])] };
  beforeEach(() => { request.mockReset(); libraryGuide.markSeen(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

  async function mount() {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ enabled: true, loggedIn: true, id: "u1", count: 1 }) }));
    const { Library } = await import("./Library");
    await act(async () => { render(<Library />); });
  }

  it("saves through /api/library/saves/art, the rod's bookmark shows the new animal, and E-38 goes after the server took it", async () => {
    let saved: ArtCombo = FIRST;
    request.mockImplementation(async (method: string, path: string, body?: { art: ArtCombo }) => {
      if (path === "/api/collection") return ok({ items: DEX });
      if (path === "/api/library/saves/art") { saved = body!.art; return ok({ ok: true, art: body!.art }); }
      return ok({ ...VIEW, shelves: [rod("a", "첫 막대", [bookmark(saved)])] });
    });
    await mount();
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(card.title) }));
    fireEvent.click(screen.getByRole("button", { name: "책갈피 꾸미기" }));
    fireEvent.click(await screen.findByRole("button", { name: "레서판다, 한정판" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이대로 꽂기" })); });
    const art = { ...FIRST, animal: "redpanda", rare: true };
    expect(request).toHaveBeenCalledWith("PATCH", "/api/library/saves/art", { isbn: card.id, art });
    expect(track).toHaveBeenCalledWith("bookmark_decorated", {
      book_id: card.id, parts_changed: ["animal"], tiers_changed: ["limited"], art, is_reset: false,
    });
    await waitFor(() => {
      const hrefs = [...document.querySelectorAll("image")].map((i) => i.getAttribute("href"));
      expect(hrefs.filter((h) => h === "/animals/redpanda.svg")).toHaveLength(2);   // the rod's and the sheet's
    });
  });

  it("a refused save puts the old picture back on the rod and sends no event", async () => {
    request.mockImplementation(async (_m: string, path: string) => {
      if (path === "/api/collection") return ok({ items: DEX });
      if (path === "/api/library/saves/art") return { ok: false, status: 403, body: { error: "forbidden" } };
      return ok(VIEW);
    });
    await mount();
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(card.title) }));
    fireEvent.click(screen.getByRole("button", { name: "책갈피 꾸미기" }));
    fireEvent.click(await screen.findByRole("button", { name: "수달, 한정판" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "이대로 꽂기" })); });
    expect(screen.getByRole("alert")).toHaveTextContent("꽂지 못했어요");
    expect(track).not.toHaveBeenCalledWith("bookmark_decorated", expect.anything());
    const hrefs = [...document.querySelectorAll("image")].map((i) => i.getAttribute("href"));
    expect(hrefs.filter((h) => h === "/animals/fox.svg").length).toBeGreaterThanOrEqual(1);
  });
});
