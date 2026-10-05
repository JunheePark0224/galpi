import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FoundItem } from "@/lib/collection/types";
import { FoundBadge, MAX_CHARS, foundLabel } from "./FoundBadge";

const cat: FoundItem = { kind: "animal", value: "cat", tier: "common" };
const fox: FoundItem = { kind: "animal", value: "fox", tier: "common" };
const peach: FoundItem = { kind: "bg", value: "peach", tier: "common" };
const moon: FoundItem = { kind: "sky", value: "moon", tier: "common" };
const grass: FoundItem = { kind: "ground", value: "grass", tier: "common" };
const rainbow: FoundItem = { kind: "sky", value: "rainbow", tier: "limited" };
const dragon: FoundItem = { kind: "animal", value: "bluedragon", tier: "first_edition" };
const galaxy: FoundItem = { kind: "bg", value: "galaxy", tier: "first_edition" };
const goldmoon: FoundItem = { kind: "sky", value: "goldmoon", tier: "first_edition" };
const clover: FoundItem = { kind: "ground", value: "clover", tier: "limited" };

describe("처음 만난 badge (도감 v1 시안 ③, 10-05 fix)", () => {
  it("names each new part, the tier only on a part above 일반판 — a common animal never reads as 한정판", () => {
    expect(foundLabel([cat])).toBe("처음 만난 고양이!");
    expect(foundLabel([fox, rainbow])).toBe("처음 만난 한정판 무지개 · 여우!");
    expect(foundLabel([fox, galaxy])).toBe("처음 만난 초판본 은하수 · 여우!");
    expect(foundLabel([galaxy, dragon])).toBe("처음 만난 초판본 청룡 외 1개!");               // 23 characters: one named
    expect(foundLabel([moon, grass])).toBe("처음 만난 달 · 풀!");
    expect(foundLabel([{ kind: "animal", value: "whitetiger", tier: "first_edition" }])).toBe("처음 만난 초판본 백호!");
  });

  it("puts the rarest first and counts the rest when more than two are new or the line would be long", () => {
    expect(foundLabel([cat, peach, moon, grass])).toBe("처음 만난 고양이 외 3개!");
    expect(foundLabel([cat, peach, rainbow])).toBe("처음 만난 한정판 무지개 외 2개!");
    expect(foundLabel([fox, galaxy, clover, goldmoon])).toBe("처음 만난 초판본 은하수 외 3개!");
    expect(foundLabel([clover, goldmoon])).toBe("처음 만난 초판본 금빛 초승달 외 1개!");     // two, but too long for one line
    expect(foundLabel([])).toBe("");
  });

  it("stays one short line on a 320px phone for every pair and every rarest part", () => {
    const all = [cat, fox, peach, moon, grass, rainbow, dragon, galaxy, goldmoon, clover,
      { kind: "bg", value: "study", tier: "first_edition" }, { kind: "animal", value: "blacktortoise", tier: "first_edition" },
      { kind: "ground", value: "goldbook", tier: "first_edition" }, { kind: "bg", value: "cherry", tier: "limited" }] as FoundItem[];
    for (const a of all) {
      expect(foundLabel([a]).length).toBeLessThanOrEqual(MAX_CHARS);
      for (const b of all) if (a !== b) expect(foundLabel([a, b, cat, peach]).length).toBeLessThanOrEqual(MAX_CHARS);
      for (const b of all) if (a !== b && a.kind !== b.kind) expect(foundLabel([a, b]).length, `${a.value} ${b.value}`).toBeLessThanOrEqual(MAX_CHARS);
    }
  });

  it("keeps an empty polite status region until there are words, then goes after its fade", () => {
    const { rerender } = render(<FoundBadge items={null} />);
    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();
    rerender(<FoundBadge items={[galaxy]} />);
    const badge = screen.getByText("처음 만난 초판본 은하수!");
    expect(badge).toHaveAttribute("data-tier", "first_edition");
    fireEvent.animationEnd(badge);
    expect(screen.queryByText("처음 만난 초판본 은하수!")).toBeNull();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("takes its colour from the rarest part, quiet when all are 일반판", () => {
    const { unmount } = render(<FoundBadge items={[cat]} />);
    expect(screen.getByText("처음 만난 고양이!")).toHaveAttribute("data-tier", "common");
    unmount();
    render(<FoundBadge items={[fox, rainbow]} />);
    expect(screen.getByText("처음 만난 한정판 무지개 · 여우!")).toHaveAttribute("data-tier", "limited");
  });
});
