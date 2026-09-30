import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BOOK_ICON, GLYPH_GAL, GLYPH_PI, Logo, LogoMark, RIBBON } from "./Logo";

describe("Logo (A-05)", () => {
  it("reads as 갈피 and keeps the 90 : 55 shape at any height", () => {
    render(<Logo height={55} />);
    const svg = screen.getByRole("img", { name: "갈피" });
    expect(svg).toHaveAttribute("width", "90");
    expect(svg.querySelectorAll("path")).toHaveLength(4);
  });

  it("the ornament is decorative", () => {
    const { container } = render(<LogoMark />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("app/icon.svg draws the same word mark and book", () => {
    const icon = readFileSync("src/app/icon.svg", "utf8");
    for (const d of [GLYPH_GAL, GLYPH_PI, BOOK_ICON, RIBBON]) expect(icon).toContain(d);
  });
});
