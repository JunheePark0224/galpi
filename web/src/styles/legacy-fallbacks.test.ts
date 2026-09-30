import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Chromium in CI has :has(), dvh and overflow: clip, so the fallbacks for older browsers are checked in the CSS text.
/** File text without CRLF and without comments (the comments talk about svh, :has() and so on). */
const read = (rel: string) =>
  readFileSync(path.resolve(import.meta.dirname, "..", rel), "utf8").replaceAll("\r\n", "\n").replaceAll(/\/\*[\s\S]*?\*\//g, "");

/** The text inside the braces of the block that starts with `header` (first match). */
function block(css: string, header: string): string {
  const start = css.indexOf(header);
  if (start < 0) throw new Error(`no block "${header}"`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") depth -= 1;
    if (depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`unclosed block "${header}"`);
}
const without = (css: string, header: string) => css.replace(`${header} {${block(css, header)}}`, "");

describe("older browsers: no :has()", () => {
  const scene = read("components/flow/BookScene.module.css");
  const globals = read("app/globals.css");
  const HAS = "@supports selector(:has(*))";

  it("keeps every desktop book-scene size behind the :has() test", () => {
    const inside = block(scene, HAS);
    expect(inside).toContain("92vw");                        // the desktop --book-h
    expect(inside).toMatch(/\.stage \{ width: calc\(var\(--book-h\) \* 1\.43\)/);
    expect(inside).toContain("--bm-scale: 1.6");
    const outside = without(scene, HAS);
    expect(outside).not.toContain("92vw");
    expect(outside).not.toContain("min-width: 768px");       // nothing outside assumes the column was released
  });

  it.each(["components/flow/Book.module.css", "components/flow/FirstPage.module.css", "app/globals.css"])(
    "%s: desktop rules (min-width: 768px) sit behind the test too, no rule is phone-only", (file) => {
      const css = read(file);
      const outside = css.includes(HAS) ? without(css, HAS) : css;
      expect(outside).not.toContain("min-width: 768px");
      expect(outside).not.toContain("max-width: 767px");   // the phone layout is the base, so it also serves the 430px column
    });

  it("releases the 430px column only behind the same test", () => {
    expect(block(globals, HAS)).toContain(".column:has([data-wide-scene]) { max-width: none; }");
    expect(without(globals, HAS)).not.toContain(":has(");
  });
});

describe("older browsers: no dvh / svh", () => {
  it("keeps viewport-height units out of the scene; it uses --screen-h", () => {
    const scene = read("components/flow/BookScene.module.css");
    expect(scene).not.toMatch(/\d(dvh|svh|lvh)/);
    expect(scene).toContain("var(--screen-h)");
  });

  it("declares --screen-h as 100vh first, and as 100svh only where svh exists", () => {
    const tokens = read("styles/tokens.css");
    expect(tokens).toMatch(/--screen-h: 100vh;/);
    expect(block(tokens, "@supports (height: 1svh)")).toMatch(/--screen-h: 100svh;/);
    expect(tokens.indexOf("--screen-h: 100vh;")).toBeLessThan(tokens.indexOf("--screen-h: 100svh;"));
  });

  it("gives the column a 100vh min-height before its 100dvh one", () => {
    const globals = read("app/globals.css");
    expect(globals.indexOf("min-height: 100vh;")).toBeGreaterThan(-1);
    expect(globals.indexOf("min-height: 100vh;")).toBeLessThan(globals.indexOf("min-height: 100dvh;"));
  });
});

describe("older browsers: no overflow: clip", () => {
  it("falls back to body overflow-x hidden only where clip is unsupported", () => {
    const globals = read("app/globals.css");
    expect(block(globals, "@supports not (overflow-x: clip)")).toMatch(/body \{ overflow-x: hidden; \}/);
    expect(read("components/flow/BookScene.module.css")).toMatch(/overflow-x: clip;/);
  });
});
