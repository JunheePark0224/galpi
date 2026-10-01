// @vitest-environment node
import { describe, expect, it } from "vitest";
import { forAmplitude, parseProps } from "./props";

const reacted = { book_id: "9788998441012", position: 2, reaction: "curious", pick_type: "random", one_liner_style: "question" };

describe("parseProps (server check against EVENT_SPEC)", () => {
  it("keeps every prop the spec defines, unchanged", () => {
    expect(parseProps("bookmark_reacted", reacted)).toEqual({ props: reacted, dropped: [] });
    expect(parseProps("entry_selected", {})).toEqual({ props: {}, dropped: [] });
    const chip = { chip_type: "len", chip_value: "thin", is_edit: true };
    expect(parseProps("chip_selected", chip)).toEqual({ props: chip, dropped: [] });
  });

  it("drops unknown keys, old names and inherited object keys, and lists them", () => {
    const raw = JSON.parse('{"kind":"random","index":2,"constructor":1,"__proto__":{"polluted":true},"toString":"x"}');
    const { props, dropped } = parseProps("bookmark_reacted", { ...reacted, ...raw });
    expect(props).toEqual(reacted);
    expect(Object.getPrototypeOf(props)).toBe(Object.prototype);
    expect(dropped.sort()).toEqual(["__proto__", "constructor", "index", "kind", "toString"]);
  });

  it("drops an Amplitude-only prop: prompt_version never reaches Supabase", () => {
    expect(parseProps("site_visited", { prompt_version: "BA400.4" })).toEqual({ props: {}, dropped: ["prompt_version"] });
  });

  it.each([
    ["a value outside the enum", "bookmark_reacted", { reaction: "love" }],
    ["a number sent as a string", "bookmark_reacted", { position: "2" }],
    ["a non-finite number", "balance_answered", { elapsed_ms: Number.POSITIVE_INFINITY }],
    ["a boolean sent as a string", "chip_selected", { is_edit: "false" }],
    ["null where the spec has no null", "goal_submitted", { topic: null }],
    ["a string that is not an enum value", "goal_submitted", { len: 1 }],
    ["an array for an object", "bookmark_shown", { art: ["fox"] }],
    ["null for an object", "bookmark_shown", { art: null }],
    ["a string for a list", "first_page_edited", { changed_items: "len" }],
    ["a list with a number in it", "free_goal_written", { keywords: ["SQL", 1] }],
    ["a list with null in it", "first_page_edited", { changed_items: ["len", null] }],
    ["a list longer than 20", "free_goal_written", { keywords: Array.from({ length: 21 }, () => "SQL") }],
  ])("drops %s", (_, name, raw) => {
    const { props, dropped } = parseProps(name as Parameters<typeof parseProps>[0], raw);
    expect(props).toEqual({});
    expect(dropped).toEqual(Object.keys(raw));
  });

  it("accepts null where the spec allows it: enum with null, nullable string", () => {
    expect(parseProps("balance_answered", { side: null }).props).toEqual({ side: null });
    expect(parseProps("chip_selected", { chip_value: null }).props).toEqual({ chip_value: null });
    expect(parseProps("yes24_link_clicked", { pick_type: null }).props).toEqual({ pick_type: null });
  });

  it("cuts goal_text to its 30 characters and other free strings to 200", () => {
    const { props } = parseProps("free_goal_written", { goal_text: "가".repeat(40), topic: "x".repeat(300), keywords: ["y".repeat(300)] });
    expect(props).toEqual({ goal_text: "가".repeat(30), topic: "x".repeat(200), keywords: ["y".repeat(200)] });
  });

  it("keeps an object prop as sent (art is a fixed small shape, the body is already size-capped)", () => {
    const art = { animal: "fox", bg: "peach", sky: "moon", ground: "grass", rare: false };
    expect(parseProps("bookmark_shown", { art }).props).toEqual({ art });
  });
});

describe("forAmplitude (taxonomy 2-7: Supabase-only props stay out of the Amplitude copy)", () => {
  it("leaves out goal_text and keeps topic, keywords, is_matched and method", () => {
    const written = { goal_text: "SQL 공부", topic: "데이터 분석", keywords: ["SQL"], is_matched: true, method: "word" };
    expect(forAmplitude("free_goal_written", written)).toEqual({ topic: "데이터 분석", keywords: ["SQL"], is_matched: true, method: "word" });
    expect(written.goal_text).toBe("SQL 공부");   // the Supabase copy is a different object, untouched
  });

  it("passes every other event's props through", () => {
    expect(forAmplitude("bookmark_reacted", reacted)).toEqual(reacted);
    expect(forAmplitude("site_visited", {})).toEqual({});
  });
});
