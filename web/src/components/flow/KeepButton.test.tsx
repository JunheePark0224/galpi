import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PickView } from "@/lib/flow/state";

const pressKeep = vi.fn();
const pressUnkeep = vi.fn();
vi.mock("@/lib/library/keep", () => ({
  pressKeep: (...a: unknown[]) => pressKeep(...a),
  pressUnkeep: (...a: unknown[]) => pressUnkeep(...a),
}));

const ISBN = "9788998441012";
const pick: PickView = {
  card: { id: ISBN, entry: "leaf", title: "모순", author: "양귀자", genre: "한국 소설", field: null, oneLiner: "?", oneLinerStyle: "question" },
  kind: "recommended",
  art: { animal: "fox", bg: "night", ground: "books", rare: false },
  reason: { label: "나온 이유", items: ["따뜻함"] },
};
const IN = { enabled: true, loggedIn: true, id: "u1", count: 0 };
const OUT = { enabled: true, loggedIn: false, id: null, count: 0 };

async function mount(me: unknown, meeting?: { seed: number; count: number; iat: number; sub: null; sig: string; isbns: string[]; index: number }) {
  vi.resetModules();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => me }));
  const [{ KeepButton }, store, guest] = await Promise.all([import("./KeepButton"), import("@/lib/account/store"), import("@/lib/library/guest")]);
  await act(async () => { await store.loadAccount(); });
  render(<><span data-pull="in" /><a data-account="" href="/library">내 책갈피</a><KeepButton pick={pick} meeting={meeting} /></>);
  return { store, guest };
}
const keepButton = () => screen.getByRole("button", { name: "내 책갈피에 저장" });

describe("KeepButton (S-06 [🔖 내 책갈피에 저장], C-16b v1.7)", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); vi.useRealTimers(); localStorage.clear(); });

  it("is not there when login is not set up", async () => {
    await mount({ enabled: false, loggedIn: false, id: null, count: 0 });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("a wide button named for where it goes, with what it is for; a press saves this book with today's Korean date and its card", async () => {
    pressKeep.mockReturnValue(true);
    await mount(IN);
    const button = keepButton();
    expect(button).toHaveTextContent("🔖 내 책갈피에 저장");
    expect(button).toHaveAccessibleDescription("나중에 다시 꺼내 볼 수 있어요");
    expect(button).not.toHaveAttribute("data-variant");                             // never the screen's main button
    fireEvent.click(button);
    expect(pressKeep).toHaveBeenCalledWith(
      { isbn: ISBN, art: pick.art, reason: pick.reason, metOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), card: pick.card }, true);
  });

  it("keeps the draw's ticket and the bookmark's place with the save, for the 도감 after a login (v1.7)", async () => {
    pressKeep.mockReturnValue(true);
    const meeting = { seed: 7, count: 5, iat: 1_790_000_000, sub: null, sig: "a".repeat(43), isbns: ["9790000000000", "9790000000001", "9790000000002", "9790000000003", "9790000000004"], index: 3 };
    await mount(OUT, meeting);
    fireEvent.click(keepButton());
    expect(pressKeep).toHaveBeenCalledWith(expect.objectContaining({ isbn: ISBN, meeting }), false);
  });

  it("logged out: the same button — no login sheet first (pressKeep, not logged in)", async () => {
    pressKeep.mockReturnValue(true);
    const { store } = await mount(OUT);
    fireEvent.click(keepButton());
    expect(pressKeep).toHaveBeenCalledWith(expect.objectContaining({ isbn: ISBN }), false);
    expect(store.loginSheetSnapshot()).toBeNull();
  });

  it("after a new save: a toast with the way to 내 책갈피, gone after 4 s (no flight where the browser cannot animate)", async () => {
    pressKeep.mockReturnValue(true);
    await mount(IN);
    vi.useFakeTimers();
    fireEvent.click(keepButton());
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("내 책갈피에 저장했어요 · 보러 가기 →");
    expect(screen.getByRole("link", { name: "보러 가기 →" })).toHaveAttribute("href", "/library");
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("no toast when nothing new was saved (full, blocked)", async () => {
    pressKeep.mockReturnValue(false);
    await mount(OUT);
    fireEvent.click(keepButton());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("logged in, follows the book's state: saved turns green with how to take it out — a second press takes it out", async () => {
    const { store } = await mount(IN);
    act(() => store.setKeepState(ISBN, "saved"));
    const saved = screen.getByRole("button", { name: "내 책갈피에 저장했어요" });
    expect(saved).toHaveTextContent("✓ 내 책갈피에 저장했어요");
    expect(saved).toHaveAccessibleDescription("다음 뽑기엔 안 나와요 · 다시 누르면 빼요");
    expect(saved).toHaveAttribute("data-saved", "");
    fireEvent.click(saved);
    expect(pressUnkeep).toHaveBeenCalledWith(ISBN, true);
    expect(pressKeep).not.toHaveBeenCalled();
  });

  it("logged out, saved = in this browser's list", async () => {
    const { guest } = await mount(OUT);
    act(() => { guest.addGuestSave({ isbn: ISBN, art: pick.art, reason: pick.reason, metOn: "2026-10-05", card: pick.card }); });
    fireEvent.click(screen.getByRole("button", { name: "내 책갈피에 저장했어요" }));
    expect(pressUnkeep).toHaveBeenCalledWith(ISBN, false);
  });

  it("says what went wrong: saving (pressed once), a failed save, a failed take-out", async () => {
    const { store } = await mount(IN);
    act(() => store.setKeepState(ISBN, "saving"));
    expect(keepButton()).toBeDisabled();
    act(() => store.setKeepState(ISBN, "failed"));
    expect(screen.getByRole("alert")).toHaveTextContent("저장하지 못했어요. 다시 눌러 주세요.");
    act(() => store.setKeepState(ISBN, "unkeepFailed"));
    expect(screen.getByRole("alert")).toHaveTextContent("빼지 못했어요. 다시 눌러 주세요.");
    expect(screen.getByRole("button", { name: "내 책갈피에 저장했어요" })).toBeEnabled();
  });

  it("100 in this browser: says so — and stops saying it once one is taken out", async () => {
    const { store, guest } = await mount(OUT);
    const other = (i: number) => `979000000${String(i).padStart(4, "0")}`;
    act(() => {
      for (let i = 0; i < guest.GUEST_MAX; i++) {
        guest.addGuestSave({ isbn: other(i), art: pick.art, reason: pick.reason, metOn: "2026-10-05", card: { ...pick.card, id: other(i) } });
      }
      store.setKeepState(ISBN, "full");
    });
    expect(screen.getByRole("alert")).toHaveTextContent("임시 책갈피는 100개까지예요. 로그인하면 계속 모을 수 있어요");
    act(() => { guest.removeGuestSave(other(0)); });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(keepButton()).toBeEnabled();
  });

  it("flies a small copy of the bookmark from the cover to the header, then lets it go", async () => {
    pressKeep.mockReturnValue(true);
    const finish: (() => void)[] = [];
    const animate = vi.fn(() => {
      const run = { onfinish: null as null | (() => void), cancel: vi.fn() };
      finish.push(() => run.onfinish?.());
      return run;
    });
    Object.defineProperty(HTMLElement.prototype, "animate", { value: animate, configurable: true });
    try {
      await mount(IN);
      fireEvent.click(keepButton());
      const copy = document.body.querySelector("[aria-hidden='true'] > div > article");
      expect(copy).not.toBeNull();
      expect(animate).toHaveBeenCalledTimes(2);                            // across, and up with an ease (a curve)
      act(() => finish[0]());
      expect(document.body.querySelector("[aria-hidden='true'] > div > article")).toBeNull();
    } finally {
      delete (HTMLElement.prototype as { animate?: unknown }).animate;
    }
  });

  it("does not fly with reduced motion", async () => {
    pressKeep.mockReturnValue(true);
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), addEventListener: () => {}, removeEventListener: () => {} }));
    await mount(IN);
    fireEvent.click(keepButton());
    expect(document.body.querySelector("article")).toBeNull();
    expect(screen.getByRole("status")).toBeInTheDocument();                   // the toast still says it
  });
});
