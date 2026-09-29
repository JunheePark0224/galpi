import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

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
});
