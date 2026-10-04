import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoundBadge, foundLabel } from "./FoundBadge";

describe("처음 만난 badge (도감 v1 시안 ③)", () => {
  it("joins the kinds in one line, sky and ground both 소품, the highest tier in front", () => {
    expect(foundLabel([{ kind: "animal", value: "cat", tier: "common" }])).toBe("처음 만난 동물!");
    expect(foundLabel([{ kind: "sky", value: "moon", tier: "common" }, { kind: "ground", value: "grass", tier: "common" }])).toBe("처음 만난 소품!");
    expect(foundLabel([{ kind: "animal", value: "otter", tier: "limited" }, { kind: "bg", value: "peach", tier: "common" }])).toBe("한정판 · 처음 만난 동물·배경!");
    expect(foundLabel([{ kind: "animal", value: "whitetiger", tier: "first_edition" }])).toBe("초판본 · 처음 만난 동물!");
  });

  it("keeps an empty polite status region until there are words, then goes after its fade", () => {
    const { rerender } = render(<FoundBadge items={null} />);
    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();
    rerender(<FoundBadge items={[{ kind: "bg", value: "galaxy", tier: "first_edition" }]} />);
    const badge = screen.getByText("초판본 · 처음 만난 배경!");
    expect(badge).toHaveAttribute("data-tier", "first_edition");
    fireEvent.animationEnd(badge);
    expect(screen.queryByText("초판본 · 처음 만난 배경!")).toBeNull();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("marks 일반판 so it is drawn smaller and quieter", () => {
    render(<FoundBadge items={[{ kind: "animal", value: "cat", tier: "common" }]} />);
    expect(screen.getByText("처음 만난 동물!")).toHaveAttribute("data-tier", "common");
  });
});
