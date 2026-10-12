import { afterEach, describe, expect, it } from "vitest";
import { BACK_COVER_OVERRIDE, backCoverExposure, firstPeekThisRound, backCoverVariant, variantOf } from "./backCover";

describe("back-cover experiment assignment (10-12, A/B by person)", () => {
  afterEach(() => { localStorage.clear(); sessionStorage.clear(); });

  it("one person always gets the same variant", () => {
    expect(variantOf("ba9cd476-145a-4434-9175-f437867e5641")).toBe(variantOf("ba9cd476-145a-4434-9175-f437867e5641"));
  });

  it("splits many people close to 50:50", () => {
    const ids = Array.from({ length: 4000 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    const b = ids.filter((id) => variantOf(id) === "B").length;
    expect(b / ids.length).toBeGreaterThan(0.47);
    expect(b / ids.length).toBeLessThan(0.53);
  });

  it("a stored override (A or B) wins — for screenshots and checks; anything else is ignored", () => {
    localStorage.setItem(BACK_COVER_OVERRIDE, "B");
    expect(backCoverVariant()).toBe("B");
    localStorage.setItem(BACK_COVER_OVERRIDE, "A");
    expect(backCoverVariant()).toBe("A");
    localStorage.setItem(BACK_COVER_OVERRIDE, "C");
    expect(["A", "B"]).toContain(backCoverVariant());
  });

  it("E-45 (taxonomy v2.6): exposed only when the 뒤표지 shuts with something 궁금해요 — the two screens differ only then", () => {
    expect(backCoverExposure("A", 0)).toBeNull();
    expect(backCoverExposure("B", 0)).toBeNull();
    expect(backCoverExposure("A", 1)).toEqual({ experiment: "back_cover_pick", variant: "a" });
    expect(backCoverExposure("B", 3)).toEqual({ experiment: "back_cover_pick", variant: "b" });
  });

  it("E-09 from the B card: once per analytics round — a reload keeps it, a new round (redraw or 처음으로) asks again", () => {
    sessionStorage.setItem("galpi.round", "1");
    expect(firstPeekThisRound()).toBe(true);
    expect(firstPeekThisRound()).toBe(false);      // pressed again, or the page reloaded in the same round
    sessionStorage.setItem("galpi.round", "2");     // nextRound() after [다시 뽑기] or [처음으로]
    expect(firstPeekThisRound()).toBe(true);
  });
});

