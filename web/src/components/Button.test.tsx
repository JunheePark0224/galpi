import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, LinkButton } from "./Button";

describe("Button", () => {
  it("renders a primary button by default", () => {
    render(<Button>궁금해요</Button>);
    const btn = screen.getByRole("button", { name: "궁금해요" });
    expect(btn).toHaveAttribute("data-variant", "primary");
    expect(btn).toHaveAttribute("type", "button");
  });

  it("renders a secondary button", () => {
    render(<Button variant="secondary">패스</Button>);
    expect(screen.getByRole("button", { name: "패스" })).toHaveAttribute("data-variant", "secondary");
  });

  it("renders a link that opens a new tab without an opener", () => {
    render(<LinkButton href="https://www.yes24.com/">예스24에서 보기 ↗</LinkButton>);
    const link = screen.getByRole("link", { name: "예스24에서 보기 ↗" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("data-variant", "primary");
  });
});
