import { describe, expect, it } from "vitest";
import { kstDate, LIBRARY_MIN_BOOKS, libraryCount, stampLibrary } from "./library";

describe("kstDate", () => {
  it("is the calendar day in Korea, which starts 9 hours before UTC's", () => {
    expect(kstDate(new Date("2026-10-01T14:59:59Z"))).toBe("2026-10-01");
    expect(kstDate(new Date("2026-10-01T15:00:00Z"))).toBe("2026-10-02");
  });
});

describe("stampLibrary (books:import)", () => {
  const before = { total: 3, added: { "2026-10-01": 3 } };

  it("stamps the books this import brings in with today's Korean date and keeps earlier days", () => {
    expect(stampLibrary(before, ["a", "b", "c"], ["a", "b", "c", "d", "e"], "2026-10-03"))
      .toEqual({ total: 5, added: { "2026-10-01": 3, "2026-10-03": 2 } });
  });

  it("adds to today when a second import the same day brings more (reviewed books after the morning run)", () => {
    const morning = stampLibrary(before, ["a", "b", "c"], ["a", "b", "c", "d"], "2026-10-03");
    expect(stampLibrary(morning, ["a", "b", "c", "d"], ["a", "b", "c", "d", "e"], "2026-10-03").added["2026-10-03"]).toBe(2);
  });

  it("changes nothing but the total when the import brings no new book (running it again)", () => {
    expect(stampLibrary(before, ["a", "b", "c"], ["a", "b", "c"], "2026-10-03")).toEqual(before);
    expect(stampLibrary(before, ["a", "b", "c"], ["a", "b"], "2026-10-03")).toEqual({ total: 2, added: { "2026-10-01": 3 } });
  });

  it("starts from nothing without an earlier library.json", () => {
    expect(stampLibrary(null, [], ["a"], "2026-10-03")).toEqual({ total: 1, added: { "2026-10-03": 1 } });
  });
});

describe("libraryCount (F-23)", () => {
  const added = { "2026-10-01": 130, "2026-10-02": 12 };

  it("stays hidden until the first fill is done (PRD F-23: about 600 books)", () => {
    expect(LIBRARY_MIN_BOOKS).toBe(600);
    expect(libraryCount(599, added, "2026-10-02")).toBeNull();
  });

  it("shows the whole catalogue and today's added books once it reaches the minimum", () => {
    expect(libraryCount(600, added, "2026-10-02")).toEqual({ total: 600, today: 12 });
  });

  it("says nothing was added on a day without new books", () => {
    expect(libraryCount(612, added, "2026-10-05")).toEqual({ total: 612, today: 0 });
  });

  it("takes another minimum (tests, a later decision)", () => {
    expect(libraryCount(330, added, "2026-10-01", 300)).toEqual({ total: 330, today: 130 });
  });
});

describe("library.json (data)", () => {
  it("was written by the same books:import as books.json — commit them together", async () => {
    const [{ default: real }, { default: data }] = await Promise.all([import("@/data/books.json"), import("@/data/library.json")]);
    expect(data.total).toBe(real.length);
    for (const [day, n] of Object.entries(data.added)) {
      expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isInteger(n) && n > 0).toBe(true);
    }
  });
});
