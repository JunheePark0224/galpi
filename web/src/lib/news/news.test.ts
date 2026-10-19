import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import data from "@/data/news.json";
import { hasUnseenNews, latestWeek, markNewsSeen, NEWS_SEEN_KEY, NEWS_WEEKS, parseWeeks, weekLabel, type NewsWeek } from "./news";

const week = (start: string, end: string, items = ["한 줄"]): NewsWeek => ({ start, end, items });

describe("news.json (PRD F-28 — the operator writes it by hand, so the shape is checked here)", () => {
  it("parses into weeks, newest first", () => {
    expect(NEWS_WEEKS.length).toBeGreaterThan(0);
    expect(NEWS_WEEKS).toEqual(parseWeeks(data));
  });

  it("every week runs Monday to Sunday with at least one non-empty line", () => {
    for (const w of NEWS_WEEKS) {
      expect(new Date(`${w.start}T00:00:00Z`).getUTCDay(), w.start).toBe(1);
      expect(w.items.length, w.start).toBeGreaterThan(0);
      for (const item of w.items) expect(item.trim(), w.start).not.toBe("");
    }
  });
});

describe("parseWeeks", () => {
  it("sorts newest first", () => {
    const parsed = parseWeeks([week("2026-10-12", "2026-10-18"), week("2026-10-19", "2026-10-25")]);
    expect(parsed.map((w) => w.start)).toEqual(["2026-10-19", "2026-10-12"]);
  });

  it.each([
    ["a start that is not a Monday", [week("2026-10-20", "2026-10-26")]],
    ["an end that is not six days after the start", [week("2026-10-19", "2026-10-24")]],
    ["a malformed date", [week("2026-10-1", "2026-10-25")]],
    ["no lines", [week("2026-10-19", "2026-10-25", [])]],
    ["a blank line", [week("2026-10-19", "2026-10-25", ["  "])]],
    ["the same line twice in a week", [week("2026-10-19", "2026-10-25", ["같은 줄", "같은 줄"])]],
    ["no weeks at all", []],
    ["the same week twice", [week("2026-10-19", "2026-10-25"), week("2026-10-19", "2026-10-25")]],
    ["not a list", { start: "2026-10-19" }],
  ])("rejects %s", (_, input) => {
    expect(() => parseWeeks(input)).toThrow();
  });
});

describe("weekLabel", () => {
  it("reads as Korean month-day dates joined by an en dash", () => {
    expect(weekLabel(week("2026-10-19", "2026-10-25"))).toBe("10월 19일 – 10월 25일");
    expect(weekLabel(week("2026-10-26", "2026-11-01"))).toBe("10월 26일 – 11월 1일");
  });
});

describe("latestWeek", () => {
  it("is the first (newest) week", () => {
    expect(latestWeek()).toBe(NEWS_WEEKS[0]);
  });
});

describe("the new-news dot (seen week kept in this browser)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("shows for someone who never opened the news", () => {
    expect(hasUnseenNews("2026-10-19")).toBe(true);
  });

  it("hides once the newest week was opened, and shows again when a newer week arrives", () => {
    markNewsSeen("2026-10-19");
    expect(localStorage.getItem(NEWS_SEEN_KEY)).toBe("2026-10-19");
    expect(hasUnseenNews("2026-10-19")).toBe(false);
    expect(hasUnseenNews("2026-10-26")).toBe(true);
  });

  it("shows when the stored value is not a date (it could never compare as older)", () => {
    localStorage.setItem(NEWS_SEEN_KEY, "x");
    expect(hasUnseenNews("2026-10-19")).toBe(true);
  });

  it("never shows when the browser blocks storage, and marking does not throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(hasUnseenNews("2026-10-19")).toBe(false);
    expect(() => markNewsSeen("2026-10-19")).not.toThrow();
  });
});
