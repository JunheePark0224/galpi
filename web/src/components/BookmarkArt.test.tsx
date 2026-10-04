import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ArtCombo } from "@/lib/art/combine";
import { BookmarkArt, PartShape } from "./BookmarkArt";

const COMMON: ArtCombo = { animal: "cat", bg: "peach", sky: "moon", ground: "grass", rare: false };
const FIRST: ArtCombo = { animal: "bluedragon", bg: "galaxy", sky: "goldmoon", ground: "goldbook", rare: true };

describe("BookmarkArt (C-03, 도감 v1)", () => {
  it("draws a common picture without any first-edition effect", () => {
    const { container } = render(<BookmarkArt art={COMMON} clipId="c1" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("data-tier", "common");
    expect(svg.querySelector("[data-part=rim]")).toBeNull();
    expect(svg.querySelector("radialGradient")).toBeNull();
    expect(svg.querySelector("image")).toHaveAttribute("href", "/animals/cat.svg");
  });

  it("gives a 초판본 picture the gold rim, aura, sparkles, dust and sweep — ids unique per instance", () => {
    const { container } = render(<><BookmarkArt art={FIRST} clipId="a" /><BookmarkArt art={{ ...FIRST, bg: "sunset" }} clipId="b" /></>);
    const [a, b] = container.querySelectorAll("svg");
    expect(a).toHaveAttribute("data-tier", "first_edition");
    expect(a.querySelector("[data-part=rim]")).not.toBeNull();
    expect(a.querySelector("radialGradient")?.id).toBe("a-aura");
    expect(b.querySelector("radialGradient")?.id).toBe("b-aura");
    expect(b.querySelector("linearGradient")?.id).toBe("b-sun");
    expect(b.querySelector("rect")?.getAttribute("fill")).toBe("url(#b-sun)");
    expect(a.querySelectorAll("path[style*='animation-delay']").length).toBe(4 + 2 + 2);   // animal 4, goldmoon 2, goldbook 2
    expect(a.querySelectorAll("circle[style*='animation-delay']").length).toBe(7);          // galaxy dust
    expect(a.querySelector("[transform='skewX(-20)']")).not.toBeNull();                     // the sweep
    const ids = [...container.querySelectorAll("[id]")].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps only the rim and a still aura when light (moving or small)", () => {
    const { container } = render(<BookmarkArt art={FIRST} clipId="l" fx="light" />);
    const svg = container.querySelector("svg")!;
    expect(svg.querySelector("[data-part=rim]")).not.toBeNull();
    expect(svg.querySelectorAll("[style*='animation-delay']")).toHaveLength(0);
    expect(svg.querySelector("[transform='skewX(-20)']")).toBeNull();
    expect(svg.querySelectorAll("circle[fill='url(#l-aura)']").length).toBe(3);             // animal + two props
  });

  it("gives a 한정판 picture its parts but no effect", () => {
    const { container } = render(<BookmarkArt art={{ animal: "otter", bg: "aurora", sky: "rainbow", ground: "firefly", rare: true }} clipId="x" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("data-tier", "limited");
    expect(svg.querySelector("[data-part=rim]")).toBeNull();
    expect(svg.querySelectorAll("path[stroke]").length).toBeGreaterThanOrEqual(4);          // the rainbow's bands
  });

  it("draws every background, sky and ground part", () => {
    for (const bg of ["cherry", "sunset", "aurora", "galaxy", "study", "night"] as const) {
      for (const [sky, ground] of [["stars", "flowers"], ["birds", "books"], ["bigStar", "mushroom"], ["cloud", "clover"], ["shooting", "none"]] as const) {
        const { container, unmount } = render(<BookmarkArt art={{ animal: "fox", bg, sky, ground, rare: true }} clipId={`${bg}-${sky}`} />);
        expect(container.querySelector("svg")).not.toBeNull();
        unmount();
      }
    }
  });

  it("draws a part's silhouette shape for the 도감 (animals as the image, props as their shape, none for backgrounds)", () => {
    const { container, rerender } = render(<PartShape kind="animal" value="otter" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "/animals/otter.svg");
    rerender(<PartShape kind="sky" value="goldmoon" />);
    expect(container.querySelector("svg circle")).not.toBeNull();
    rerender(<PartShape kind="ground" value="clover" />);
    expect(container.querySelector("svg circle")).not.toBeNull();
    rerender(<PartShape kind="ground" value="none" />);
    expect(container.firstChild).toBeNull();
    rerender(<PartShape kind="bg" value="galaxy" />);
    expect(container.firstChild).toBeNull();
  });
});
