import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetFlowHome, setFlowHome } from "@/lib/nav/homeLink";
import { HomeLink } from "./HomeLink";

const pathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));

describe("HomeLink — header [처음으로] (10-09, D안)", () => {
  afterEach(() => { forgetFlowHome(); pathname.mockReturnValue("/"); });

  it("on / it stays hidden at S-01 (and before the flow is there)", () => {
    render(<HomeLink />);
    expect(screen.queryByText("처음으로")).toBeNull();
  });

  it("on / mid-flow it shows and goes home in place — no confirmation, no page load", () => {
    const home = vi.fn();
    render(<HomeLink />);
    act(() => { setFlowHome(home); });
    const link = screen.getByRole("link", { name: "처음으로" });
    expect(link).toHaveAttribute("href", "/");
    const notPrevented = fireEvent.click(link);
    expect(home).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false);
  });

  it("a new-tab click (ctrl / cmd / middle) is left to the browser", () => {
    const home = vi.fn();
    render(<HomeLink />);
    act(() => { setFlowHome(home); });
    expect(fireEvent.click(screen.getByRole("link", { name: "처음으로" }), { ctrlKey: true })).toBe(true);
    expect(home).not.toHaveBeenCalled();
  });

  it("hides again once the flow is back at S-01", () => {
    render(<HomeLink />);
    act(() => { setFlowHome(vi.fn()); });
    act(() => { setFlowHome(null); });
    expect(screen.queryByText("처음으로")).toBeNull();
  });

  it("on other pages it is a plain link to / (like the logo)", () => {
    pathname.mockReturnValue("/library");
    render(<HomeLink />);
    const link = screen.getByRole("link", { name: "처음으로" });
    expect(link).toHaveAttribute("href", "/");
    expect(fireEvent.click(link)).toBe(true);
  });
});
