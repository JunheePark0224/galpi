import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "./SiteHeader";

describe("SiteHeader", () => {
  it("shows only the logo — no login text, link or button before P5", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("img", { name: "갈피" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("로그인")).toBeNull();
  });
});
