import { describe, expect, it } from "vitest";
import { fitTitle, MIN_TITLE_PX } from "./fitTitle";

/** A fake title box: room for `data-lines` lines, and the text needs `lines(px)` lines at a given size. */
function box(lines: (px: number) => number) {
  const el = {
    style: { fontSize: "" },
    dataset: {} as DOMStringMap,
    get scrollHeight() { const px = parseFloat(el.style.fontSize); return lines(px) * px; },
    get clientHeight() { const px = parseFloat(el.style.fontSize); return Math.min(lines(px), Number(el.dataset.lines)) * px; },
  };
  return el;
}

describe("fitTitle", () => {
  it("lets glyphs reach a little past the last line without counting it as a hidden line", () => {
    const el = { style: { fontSize: "" }, dataset: {} as DOMStringMap, scrollHeight: 43, clientHeight: 41 };   // 『…』 at 12px, three lines
    expect(fitTitle(el, 15)).toEqual({ lines: 2, px: 15 });
  });

  it("keeps the stylesheet size on two lines when the title fits", () => {
    const el = box(() => 2);
    expect(fitTitle(el, 15)).toEqual({ lines: 2, px: 15 });
    expect(el.style.fontSize).toBe("15px");
    expect(el.dataset.lines).toBe("2");
  });

  it("steps down 1px at a time on two lines first", () => {
    const el = box((px) => (px > 13 ? 3 : 2));
    expect(fitTitle(el, 15)).toEqual({ lines: 2, px: 13 });
  });

  it("takes a third line at 13px when 12px on two lines is not enough", () => {
    const el = box(() => 3);
    expect(fitTitle(el, 15)).toEqual({ lines: 3, px: 13 });
    expect(el.dataset.lines).toBe("3");
    expect(el.style.fontSize).toBe("13px");
  });

  it("goes to 12px on three lines, never under — past that the clamp ends it in …", () => {
    const fits12 = box((px) => (px > 12 ? 4 : 3));
    expect(fitTitle(fits12, 15)).toEqual({ lines: 3, px: MIN_TITLE_PX });
    const never = box(() => 4);
    expect(fitTitle(never, 15)).toEqual({ lines: 3, px: MIN_TITLE_PX });
    expect(never.style.fontSize).toBe("12px");
  });
});
