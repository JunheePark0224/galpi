import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BACKGROUNDS, GROUND_PROPS, LIVING_BACKGROUNDS, type ArtCombo, type Background } from "@/lib/art/combine";
import { BookmarkArt, PartShape } from "./BookmarkArt";

const COMMON: ArtCombo = { animal: "cat", bg: "peach", ground: "grass", rare: false };
const FIRST: ArtCombo = { animal: "bluedragon", bg: "galaxy", ground: "goldbook", rare: true };
const moving = (el: Element) => el.querySelectorAll("[style*='animation-delay']");

describe("BookmarkArt (C-03, 도감 v1, three parts — 10-07 A)", () => {
  it("draws a common picture: a plain sky, the hill, the animal, the ground prop — no effect, nothing living", () => {
    const { container } = render(<BookmarkArt art={COMMON} clipId="c1" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("data-tier", "common");
    expect(svg.querySelector("[data-part=rim]")).toBeNull();
    expect(svg.querySelector("radialGradient")).toBeNull();
    expect(svg.querySelector("image")).toHaveAttribute("href", "/animals/cat.svg");
    expect(svg.querySelector("[data-part=living]")!.children).toHaveLength(0);
    expect(moving(svg)).toHaveLength(0);
  });

  it("gives a 초판본 picture the gold rim, aura, sparkles, its living background and the sweep — ids unique per instance", () => {
    const { container } = render(<><BookmarkArt art={FIRST} clipId="a" /><BookmarkArt art={{ ...FIRST, bg: "sunset" }} clipId="b" /></>);
    const [a, b] = container.querySelectorAll("svg");
    expect(a).toHaveAttribute("data-tier", "first_edition");
    expect(a.querySelector("[data-part=rim]")).not.toBeNull();
    expect(a.querySelector("radialGradient")?.id).toMatch(/^a-.+-aura$/);
    expect(b.querySelector("radialGradient")?.id).toMatch(/^b-.+-aura$/);
    const sun = b.querySelector("linearGradient")!.id;
    expect(sun).toMatch(/^b-[A-Za-z0-9_-]+-sun$/);
    expect(b.querySelector("rect")?.getAttribute("fill")).toBe(`url(#${sun})`);
    expect(a.querySelectorAll("path[style*='animation-delay']").length).toBe(4 + 2);          // animal 4, goldbook 2
    expect(a.querySelectorAll("[data-part=living] circle[style*='animation-delay']").length).toBe(8);   // galaxy stars twinkle
    expect(a.querySelector("[data-part=living] [opacity='0']")).not.toBeNull();               // the shooting star, seen only in motion
    expect(a.querySelector("[transform='skewX(-20)']")).not.toBeNull();                       // the sweep
    const ids = [...container.querySelectorAll("[id]")].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("puts the gold rim and the sweep on a 초판본 background only — never for a 초판본 animal or prop (10-07)", () => {
    const { container, rerender } = render(<BookmarkArt art={{ ...FIRST, bg: "night" }} clipId="r" />);
    let svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("data-tier", "first_edition");
    expect(svg.querySelector("[data-part=rim]")).toBeNull();
    expect(svg.querySelector("[transform='skewX(-20)']")).toBeNull();
    rerender(<BookmarkArt art={{ ...COMMON, bg: "study" }} clipId="r" />);
    svg = container.querySelector("svg")!;
    expect(svg.querySelector("[data-part=rim]")).not.toBeNull();
    expect(svg.querySelector("[transform='skewX(-20)']")).not.toBeNull();
    rerender(<BookmarkArt art={{ ...COMMON, bg: "study" }} clipId="r" parts={["animal"]} stage={false} />);
    expect(container.querySelector("[data-part=rim]")).toBeNull();                             // 도감 동물 칸: no background, no rim
  });

  it("gives each 초판본 animal its own aura behind it — 청룡 clouds, 백호 blue fire, 주작 fire, 현무 water", () => {
    const want = { bluedragon: "clouds", whitetiger: "blue-fire", redbird: "fire", blacktortoise: "water" } as const;
    for (const [animal, aura] of Object.entries(want)) {
      const { container, unmount } = render(<BookmarkArt art={{ ...COMMON, animal: animal as ArtCombo["animal"] }} clipId={animal} />);
      const svg = container.querySelector("svg")!;
      const el = svg.querySelector("[data-part=animal-aura]")!;
      expect(el, animal).toHaveAttribute("data-aura", aura);
      expect(el.compareDocumentPosition(svg.querySelector("image")!) & Node.DOCUMENT_POSITION_FOLLOWING, animal).toBeTruthy();   // behind
      unmount();
    }
    const { container } = render(<BookmarkArt art={{ ...COMMON, animal: "otter" }} clipId="o" />);
    expect(container.querySelector("[data-part=animal-aura]")).toBeNull();
  });

  it("dresses the clover with a gold ribbon and a dew drop, and draws the 10-07 rare props (찻잔 김, 반딧불 병, 오르골 회전)", () => {
    const art = (ground: ArtCombo["ground"]) => ({ ...COMMON, ground });
    const { container, rerender } = render(<BookmarkArt art={art("clover")} clipId="g" />);
    expect(container.querySelector("[data-part=ribbon]")).not.toBeNull();
    expect(container.querySelector("[data-part=dew]")).not.toBeNull();
    rerender(<BookmarkArt art={art("teacup")} clipId="g" />);
    expect(container.querySelectorAll("[data-part=steam] path").length).toBeGreaterThan(1);
    rerender(<BookmarkArt art={art("jar")} clipId="g" />);
    expect(container.querySelectorAll("[data-part=jar-light] g").length).toBe(3);
    rerender(<BookmarkArt art={art("quill")} clipId="g" />);
    expect(container.querySelector("[data-part=quill]")).not.toBeNull();
    rerender(<BookmarkArt art={art("musicbox")} clipId="g" />);
    expect(container.querySelector("[data-part=orbit]")).not.toBeNull();
    expect(container.querySelectorAll("path[style*='animation-delay']").length).toBe(3);      // its star dust
  });

  it("keeps only the rim, a still aura and still living things when light (moving or small)", () => {
    const { container } = render(<BookmarkArt art={FIRST} clipId="l" fx="light" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("class")).toMatch(/still/);
    expect(svg.querySelector("[data-part=rim]")).not.toBeNull();
    expect(svg.querySelectorAll("path[style*='animation-delay']")).toHaveLength(0);           // no sparkles
    expect(svg.querySelector("[transform='skewX(-20)']")).toBeNull();
    expect(svg.querySelectorAll("[data-part=living] circle").length).toBeGreaterThan(0);      // the galaxy still drawn
    const aura = svg.querySelector("radialGradient")!.id;
    expect(svg.querySelectorAll(`circle[fill='url(#${aura})']`).length).toBe(1);              // the prop's glow
    expect(svg.querySelector("[data-part=animal-aura]")).not.toBeNull();                     // the dragon's clouds, still
  });

  it("keeps ids apart when the same book is drawn twice on one page (rod + sheet, drag copy)", () => {
    const { container } = render(<><BookmarkArt art={FIRST} clipId="arch-978" /><BookmarkArt art={FIRST} clipId="arch-978" /></>);
    const ids = [...container.querySelectorAll("[id]")].map((el) => el.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    const [first, second] = container.querySelectorAll("svg");
    expect(first.querySelector("g[clip-path]")?.getAttribute("clip-path")).toBe(`url(#${first.querySelector("clipPath")!.id})`);
    expect(second.querySelector("g[clip-path]")?.getAttribute("clip-path")).toBe(`url(#${second.querySelector("clipPath")!.id})`);
  });

  it("gives a 한정판 picture its living background and the clover's glint, but no 초판본 effect", () => {
    const { container } = render(<BookmarkArt art={{ animal: "otter", bg: "summer", ground: "clover", rare: true }} clipId="x" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("data-tier", "limited");
    expect(svg.querySelector("[data-part=rim]")).toBeNull();
    expect(svg.querySelectorAll("[data-part=living] g[style*='animation-delay']")).toHaveLength(6);   // the fireflies rise
    expect(svg.querySelector("[data-part=glint]")).not.toBeNull();
  });

  it("makes every 한정판·초판본 background living and every 일반판 one a plain sky", () => {
    for (const bg of Object.keys(BACKGROUNDS) as Background[]) {
      const { container, unmount } = render(<BookmarkArt art={{ animal: "fox", bg, ground: "none", rare: false }} clipId={bg} />);
      const living = container.querySelector("[data-part=living]")!;
      if (LIVING_BACKGROUNDS.has(bg)) expect(moving(living).length, bg).toBeGreaterThan(0);
      else expect(living.children, bg).toHaveLength(0);
      unmount();
    }
  });

  it("draws every ground prop", () => {
    for (const ground of GROUND_PROPS) {
      const { container, unmount } = render(<BookmarkArt art={{ animal: "fox", bg: "night", ground, rare: false }} clipId={ground} />);
      expect(container.querySelector("svg"), ground).not.toBeNull();
      unmount();
    }
  });

  it("draws only the listed parts on the background's sky and hill; the tier and effects follow them (도감 칸)", () => {
    const { container, rerender } = render(<BookmarkArt art={FIRST} clipId="p" parts={["bg"]} />);
    let svg = container.querySelector("svg")!;
    expect(svg.querySelector("image")).toBeNull();
    expect(svg.querySelector("rect")).toHaveAttribute("fill", "#141936");                  // galaxy sky
    expect(svg).toHaveAttribute("data-tier", "first_edition");
    expect(svg.querySelectorAll("path[style*='animation-delay']")).toHaveLength(0);           // no animal or prop sparkles

    rerender(<BookmarkArt art={{ ...FIRST, bg: "night" }} clipId="p" parts={["ground"]} />);
    svg = container.querySelector("svg")!;
    expect(svg.querySelector("image")).toBeNull();
    expect(svg.querySelector("g[transform^='translate(50 ']")).not.toBeNull();             // the lone prop, centred
    expect(svg.querySelectorAll("path[style*='animation-delay']")).toHaveLength(2);           // goldbook's two sparkles
    expect(svg).toHaveAttribute("data-tier", "first_edition");

    rerender(<BookmarkArt art={{ ...FIRST, ground: "grass" }} clipId="p" parts={["animal"]} />);
    svg = container.querySelector("svg")!;
    expect(svg.querySelector("image")).toHaveAttribute("href", "/animals/bluedragon.svg");
    expect(svg.querySelector("g[transform^='translate(50 ']")).toBeNull();
    expect(svg.querySelectorAll("path[style*='animation-delay']")).toHaveLength(4);           // the animal's four

    rerender(<BookmarkArt art={{ ...COMMON, bg: "galaxy" }} clipId="p" parts={["animal"]} fx="light" />);
    expect(container.querySelector("svg")).toHaveAttribute("data-tier", "common");           // a gold background is not the cat's
  });

  it("stage={false} (도감 동물·소품 칸, 10-07): no sky, no living background, no hill — the part alone", () => {
    const { container, rerender } = render(<BookmarkArt art={FIRST} clipId="p" parts={["animal"]} stage={false} fx="light" />);
    let svg = container.querySelector("svg")!;
    expect(svg.querySelector("image")).toHaveAttribute("href", "/animals/bluedragon.svg");
    expect(svg.querySelector("rect")).toBeNull();                                            // no sky, no galaxy band
    expect(svg.querySelector("[data-part=living]")).toBeNull();
    expect(svg.querySelector("path[d^='M-5 76']")).toBeNull();                                // no hill
    expect(svg).toHaveAttribute("data-tier", "first_edition");
    expect(svg.querySelector("[data-part=rim]")).toBeNull();                                  // the rim belongs to the background

    rerender(<BookmarkArt art={{ ...COMMON, ground: "books" }} clipId="p" parts={["ground"]} stage={false} fx="light" />);
    svg = container.querySelector("svg")!;
    expect(svg.querySelector("g[transform^='translate(50 '] rect")).not.toBeNull();            // the books themselves
    expect(svg.querySelector("path[d^='M-5 76']")).toBeNull();
  });

  it("draws a part's silhouette shape for the 도감 (animals as the image, props as their shape, none for backgrounds)", () => {
    const { container, rerender } = render(<PartShape kind="animal" value="otter" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "/animals/otter.svg");
    rerender(<PartShape kind="ground" value="clover" />);
    expect(container.querySelector("svg circle")).not.toBeNull();
    expect(container.querySelector("svg g[transform]")).not.toBeNull();                       // as its met cell: centred
    rerender(<PartShape kind="ground" value="none" />);
    expect(container.firstChild).toBeNull();
    rerender(<PartShape kind="bg" value="galaxy" />);
    expect(container.firstChild).toBeNull();
  });
});
