// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { artsForDraw } from "@/lib/art/combine";
import { catalog } from "@/lib/books/catalog";
import { drawPath } from "@/lib/books/draw";
import { QUESTION_MAP } from "@/lib/paths";
import { SQL_PATH } from "@/lib/paths/__fixtures__/paths";
import { mulberry32 } from "@/lib/recommend";
import { encodeShare } from "./code";
import { artUri, cssColour, intrinsic, shareImage, SIZES, svgText } from "./image";
import { loadShare } from "./load";

const geist = readFileSync("node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf");
const FONT = geist.buffer.slice(geist.byteOffset, geist.byteOffset + geist.byteLength) as ArrayBuffer;
const decode = (uri: string) => Buffer.from(uri.split(",")[1], "base64").toString("utf8");

describe("share images (F-27) — the 뒤표지 alone, drawn on the server", () => {
  it("turns a colour token into the hex next/og needs, and leaves a plain colour alone", () => {
    expect(cssColour("var(--genre-essay)")).toBe("#4A7456");
    expect(cssColour("#FFFFFF")).toBe("#FFFFFF");
    expect(cssColour("var(--no-such-token)")).toBe("#7A6048");
  });

  it("calls helper components and fragments through to plain tags", () => {
    const Leaf = ({ n }: { n: number }) => <><rect width={n} /><circle r={n} /></>;
    const tree = intrinsic(<g><Leaf n={2} />text</g>);
    expect(svgText(tree)).toBe('<g><rect width="2"></rect><circle r="2"></circle>text</g>');
  });

  it("writes SVG text: kebab-case attributes, viewBox kept, styles without animations, no aria or class", () => {
    const el = <svg viewBox="0 0 1 1" aria-hidden="true" className="x"><path strokeWidth={2} style={{ animationDelay: "1s", opacity: 0.5 }} d={'a"b'} /></svg>;
    expect(svgText(el)).toBe('<svg viewBox="0 0 1 1"><path stroke-width="2" d="a&quot;b" style="opacity:0.5"></path></svg>');
    expect(svgText([null, false, "a<b"])).toBe("a&lt;b");
  });

  it("draws a bookmark picture as one SVG with the animal inlined (no path next/og would have to fetch)", () => {
    const svg = decode(artUri({ animal: "dog", bg: "galaxy", ground: "musicbox", rare: true }, "t"));
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" /);
    expect(svg).toContain('width="200" height="152"');
    expect(svg).toContain("data:image/svg+xml;base64,");
    expect(svg).not.toContain("/animals/");
  });

  it("renders the link preview and the story as PNGs of their sizes", async () => {
    const drawn = drawPath(SQL_PATH, new Set(), mulberry32(3), catalog());
    const code = encodeShare(QUESTION_MAP, { answers: SQL_PATH, books: drawn.picks.map((p) => p.card.id), arts: artsForDraw(5, 9) });
    const view = loadShare(code)!;
    for (const kind of ["og", "story"] as const) {
      const res = await shareImage(view, kind, { batang: FONT, dodum: FONT });
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(res.headers.get("cache-control")).toContain("stale-while-revalidate");
      const png = Buffer.from(await res.arrayBuffer());
      expect(png.readUInt32BE(16)).toBe(SIZES[kind].width);
      expect(png.readUInt32BE(20)).toBe(SIZES[kind].height);
    }
    const none = await shareImage({ ...view, label: { chips: [], challenge: false } }, "og", { batang: FONT, dodum: FONT });
    expect((await none.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  }, 60000);
});
