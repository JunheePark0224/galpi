import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const me = (body: unknown) => vi.fn().mockResolvedValue({ ok: true, json: async () => body });

async function setup(body: unknown) {
  vi.resetModules();
  vi.stubGlobal("fetch", me(body));
  const [{ AccountButton }, store] = await Promise.all([import("./AccountButton"), import("@/lib/account/store")]);
  render(<AccountButton />);
  await act(async () => { await store.loadAccount(); });
  return store;
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); localStorage.clear(); });

const GUEST = {
  isbn: "9788998441012", art: { animal: "fox", bg: "night", ground: "books", rare: false }, reason: { label: "나온 이유", items: [] },
  metOn: "2026-10-05",
  card: { id: "9788998441012", entry: "leaf", title: "모순", author: "양귀자", genre: "한국 소설", field: null, oneLiner: "?", oneLinerStyle: "question" },
};

describe("AccountButton (header, PRD F-11·F-13)", () => {
  it("shows nothing when login is not set up", async () => {
    await setup({ enabled: false, loggedIn: false, id: null, count: 0 });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("offers [로그인], which opens the sheet from the header", async () => {
    const store = await setup({ enabled: true, loggedIn: false, id: null, count: 0 });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(store.loginSheetSnapshot()).toEqual({ source: "header" });
  });

  it("becomes [내 책갈피 N] linking to S-09 once logged in", async () => {
    const store = await setup({ enabled: true, loggedIn: true, id: "u1", count: 6 });
    expect(screen.getByRole("link", { name: "내 책갈피 6개" })).toHaveAttribute("href", "/library");
    act(() => store.setSavedCount(7));
    expect(screen.getByRole("link", { name: "내 책갈피 7개" })).toBeInTheDocument();
  });

  it("logged out with bookmarks kept in this browser: [내 책갈피 N] too, following the list (v1.7)", async () => {
    localStorage.setItem("galpi.guestSaves", JSON.stringify({ v: 1, items: [GUEST] }));
    await setup({ enabled: true, loggedIn: false, id: null, count: 0 });
    expect(screen.getByRole("link", { name: "내 책갈피 1개" })).toHaveAttribute("data-account", "");
    const guest = await import("@/lib/library/guest");
    act(() => { guest.removeGuestSave(GUEST.isbn); });
    expect(screen.getByRole("button", { name: "로그인" })).toHaveAttribute("data-account", "");
  });

  it("shows +1 by the number after an S-06 save — once the copy has landed (600 ms), for 1.5 s", async () => {
    const store = await setup({ enabled: true, loggedIn: true, id: "u1", count: 1 });
    vi.useFakeTimers();
    act(() => store.announceKept());
    expect(screen.queryByText("+1")).toBeNull();
    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByText("+1")).toHaveAttribute("aria-hidden", "true");
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.queryByText("+1")).toBeNull();
  });

  it("with reduced motion the +1 shows at once", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), addEventListener: () => {}, removeEventListener: () => {} }));
    const store = await setup({ enabled: true, loggedIn: true, id: "u1", count: 1 });
    vi.useFakeTimers();
    act(() => store.announceKept());
    act(() => vi.advanceTimersByTime(0));
    expect(screen.getByText("+1")).toBeInTheDocument();
  });
});
