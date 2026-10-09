import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./SiteHeader";

// On / at S-01: the header [처음으로] (HomeLink, 10-09) stays hidden until the flow leaves S-01.
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("SiteHeader", () => {
  // /api/me never answers here: the account place (P5 AccountButton) stays in its first, empty state.
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {}))); });

  it("the logo is a plain link home (a full navigation resets the flow) named for what it does", () => {
    render(<SiteHeader />);
    const home = screen.getByRole("link", { name: "갈피 처음 화면" });
    expect(home).toHaveAttribute("href", "/");
    expect(home.querySelector("svg")).not.toBeNull();
  });

  it("shows only the logo until /api/me answers — the P5 account place (AccountButton) stays empty meanwhile", () => {
    render(<SiteHeader />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("로그인")).toBeNull();
  });
});
