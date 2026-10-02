import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PickView } from "@/lib/flow/state";

const pressKeep = vi.fn();
vi.mock("@/lib/library/keep", () => ({ pressKeep: (...a: unknown[]) => pressKeep(...a) }));

const ISBN = "9788998441012";
const pick: PickView = {
  card: { id: ISBN, entry: "leaf", title: "모순", author: "양귀자", genre: "한국 소설", field: null, oneLiner: "?", oneLinerStyle: "question" },
  kind: "recommended",
  art: { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false },
  reason: { label: "나온 이유", items: ["따뜻함"] },
};

async function mount(me: unknown) {
  vi.resetModules();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => me }));
  const [{ KeepButton }, store] = await Promise.all([import("./KeepButton"), import("@/lib/account/store")]);
  await act(async () => { await store.loadAccount(); });
  render(<KeepButton pick={pick} />);
  return store;
}

describe("KeepButton (S-06 [🔖 꽂기] next to the title, C-16b)", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it("is not there when login is not set up", async () => {
    await mount({ enabled: false, loggedIn: false, id: null, count: 0 });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("logged in: a small 🔖 꽂기 pill named for where it goes; a press keeps this book with today's Korean date", async () => {
    await mount({ enabled: true, loggedIn: true, id: "u1", count: 0 });
    const pill = screen.getByRole("button", { name: "내 책갈피에 꽂기" });
    expect(pill).toHaveTextContent("🔖 꽂기");                                   // label-in-name: the visible 꽂기 is in the name
    expect(pill).not.toHaveAttribute("data-variant");                             // never the screen's main button
    fireEvent.click(pill);
    expect(pressKeep).toHaveBeenCalledWith(
      { isbn: ISBN, art: pick.art, reason: pick.reason, metOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }, true);
  });

  it("logged out: the same pill — the press goes on to the login sheet (pressKeep, not logged in)", async () => {
    await mount({ enabled: true, loggedIn: false, id: null, count: 0 });
    expect(screen.queryByText("로그인하면 내 책갈피에 모여요")).toBeNull();          // the S-07 sheet says it (10-02)
    fireEvent.click(screen.getByRole("button", { name: "내 책갈피에 꽂기" }));
    expect(pressKeep).toHaveBeenCalledWith(expect.objectContaining({ isbn: ISBN }), false);
  });

  it("follows the book's keep state: saving (pressed once), kept with a way to 내 책갈피, failed", async () => {
    const store = await mount({ enabled: true, loggedIn: true, id: "u1", count: 0 });
    act(() => store.setKeepState(ISBN, "saving"));
    expect(screen.getByRole("button", { name: "내 책갈피에 꽂기" })).toBeDisabled();
    act(() => store.setKeepState(ISBN, "failed"));
    expect(screen.getByRole("alert")).toHaveTextContent("꽂지 못했어요. 다시 눌러 주세요.");
    act(() => store.setKeepState(ISBN, "saved"));
    expect(screen.getByRole("status")).toHaveTextContent("꽂았어요 ✓");
    expect(screen.getByRole("link", { name: "내 책갈피 보기" })).toHaveAttribute("href", "/library");
  });
});
