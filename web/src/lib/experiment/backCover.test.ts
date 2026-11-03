import { afterEach, describe, expect, it } from "vitest";
import { BACK_COVER_OVERRIDE, firstPeekThisRound, backCoverVariant } from "./backCover";

describe("back-cover experiment (10-12 ~ 11-03, ended: everyone sees A)", () => {
  afterEach(() => { localStorage.clear(); sessionStorage.clear(); });

  it("ended 11-03 (report/README.md): with nothing pinned every browser gets A", () => {
    for (const id of ["ba9cd476-145a-4434-9175-f437867e5641", "00000000-0000-4000-8000-000000000001"]) {
      localStorage.setItem("galpi.anon", id);
      expect(backCoverVariant()).toBe("A");
    }
  });

  it("a stored override (A or B) wins — the old B screen stays viewable for the record; anything else is ignored", () => {
    localStorage.setItem(BACK_COVER_OVERRIDE, "B");
    expect(backCoverVariant()).toBe("B");
    localStorage.setItem(BACK_COVER_OVERRIDE, "A");
    expect(backCoverVariant()).toBe("A");
    localStorage.setItem(BACK_COVER_OVERRIDE, "C");
    expect(backCoverVariant()).toBe("A");
  });

  it("E-09 from the B card: once per analytics round — a reload keeps it, a new round (redraw or 처음으로) asks again", () => {
    sessionStorage.setItem("galpi.round", "1");
    expect(firstPeekThisRound()).toBe(true);
    expect(firstPeekThisRound()).toBe(false);      // pressed again, or the page reloaded in the same round
    sessionStorage.setItem("galpi.round", "2");     // nextRound() after [다시 뽑기] or [처음으로]
    expect(firstPeekThisRound()).toBe(true);
  });

  it("?ab=a|b in the address pins this browser (a phone has no console), ?ab=off unpins; the switch leaves the address", () => {
    window.history.replaceState(null, "", "/?ab=b&utm_source=threads");
    expect(backCoverVariant()).toBe("B");
    expect(window.location.search).toBe("?utm_source=threads");   // other tags stay for the visit event
    window.history.replaceState(null, "", "/");
    expect(backCoverVariant()).toBe("B");                          // kept in this browser
    window.history.replaceState(null, "", "/?ab=a");
    expect(backCoverVariant()).toBe("A");
    window.history.replaceState(null, "", "/?ab=off");
    backCoverVariant();
    expect(localStorage.getItem(BACK_COVER_OVERRIDE)).toBeNull();
    expect(window.location.search).toBe("");
    window.history.replaceState(null, "", "/?ab=zzz");
    backCoverVariant();
    expect(localStorage.getItem(BACK_COVER_OVERRIDE)).toBeNull();
    window.history.replaceState(null, "", "/");
  });
});

