import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "./SiteHeader";

describe("SiteHeader", () => {
  it("the logo is a plain link home (a full navigation resets the flow) named for what it does", () => {
    render(<SiteHeader />);
    const home = screen.getByRole("link", { name: "갈피 처음 화면" });
    expect(home).toHaveAttribute("href", "/");
    expect(home.querySelector("svg")).not.toBeNull();
  });

  it("has no other header item — no login text, no button before P5", () => {
    render(<SiteHeader />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("로그인")).toBeNull();
  });
});
