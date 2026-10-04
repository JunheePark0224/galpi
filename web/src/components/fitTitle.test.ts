import { describe, expect, it } from "vitest";
import { fitTitle, MIN_TITLE_PX } from "./fitTitle";

/** A fake title box: two lines of room, and the text needs `lines(px)` lines at a given size. */
function box(lines: (px: number) => number) {
  const el = {
    style: { fontSize: "" },
    get scrollHeight() { const px = parseFloat(el.style.fontSize); return lines(px) * px * 1.3; },
    get clientHeight() { const px = parseFloat(el.style.fontSize); return Math.min(lines(px), 2) * px * 1.3; },
  };
  return el;
}

describe("fitTitle", () => {
  it("keeps the stylesheet size when the title fits", () => {
    const el = box(() => 2);
    expect(fitTitle(el, 15)).toBe(15);
    expect(el.style.fontSize).toBe("15px");
  });

  it("steps down 1px at a time until the title fits", () => {
    const el = box((px) => (px > 13 ? 3 : 2));
    expect(fitTitle(el, 15)).toBe(13);
    expect(el.style.fontSize).toBe("13px");
  });

  it("never goes under 12px — past that the clamp ends the title in …", () => {
    const el = box(() => 3);
    expect(fitTitle(el, 15)).toBe(MIN_TITLE_PX);
    expect(el.style.fontSize).toBe("12px");
  });
});
