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

afterEach(() => vi.unstubAllGlobals());

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
});
