import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("keeps the credit line and links the privacy policy", () => {
    render(<Footer />);
    expect(screen.getByText(/정보 제공: 예스24 · 예스24와 무관한 개인 프로젝트/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "처리방침" });
    expect(link).toHaveAttribute("href", "/privacy");
    expect(link).not.toHaveAttribute("target");
  });
});
