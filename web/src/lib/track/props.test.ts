// @vitest-environment node
import { describe, expect, it } from "vitest";
import { forAmplitude, parseProps } from "./props";

const reacted = { book_id: "9788998441012", position: 2, reaction: "curious", pick_type: "random", one_liner_style: "question" };

describe("parseProps (server check against EVENT_SPEC)", () => {
  it("keeps every prop the spec defines, unchanged", () => {
    expect(parseProps("bookmark_reacted", reacted)).toEqual({ props: reacted, dropped: [] });
    expect(parseProps("entry_selected", {})).toEqual({ props: {}, dropped: [] });
    const answered = { node_id: "learn-area", kind: "narrow", choice: "unsure", depth: 4, position: 5, elapsed_ms: 1200 };
    expect(parseProps("question_answered", answered)).toEqual({ props: answered, dropped: [] });
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
    ["a non-finite number", "question_answered", { elapsed_ms: Number.POSITIVE_INFINITY }],
    ["a boolean sent as a string", "save_clicked", { is_logged_in: "false" }],
    ["null where the spec has no null", "question_answered", { node_id: null }],
    ["a value that is not an enum value", "question_answered", { kind: 1 }],
    ["an array for an object", "bookmark_shown", { art: ["fox"] }],
    ["null for an object", "bookmark_shown", { art: null }],
    ["a list for a string", "bookmark_moved", { book_id: ["9788998441012"] }],
  ])("drops %s", (_, name, raw) => {
    const { props, dropped } = parseProps(name as Parameters<typeof parseProps>[0], raw);
    expect(props).toEqual({});
    expect(dropped).toEqual(Object.keys(raw));
  });

  it("accepts null where the spec allows it: enum with null, nullable string", () => {
    expect(parseProps("yes24_link_clicked", { book_id: null, source: "first_page", pick_type: null }))
      .toEqual({ props: { book_id: null, source: "first_page", pick_type: null }, dropped: [] });   // F-24: no book
    expect(parseProps("yes24_link_clicked", { pick_type: null }).props).toEqual({ pick_type: null });
  });

  it("cuts feedback_text to its 500 characters and other free strings to 200", () => {
    const { props } = parseProps("feedback_sent", { feedback_text: "가".repeat(600), text_length: 600 });
    expect(props).toEqual({ feedback_text: "가".repeat(500), text_length: 600 });
    expect(parseProps("path_completed", { scope_id: "x".repeat(300) }).props).toEqual({ scope_id: "x".repeat(200) });
  });

  it("keeps an object prop as sent (art is a fixed small shape, the body is already size-capped)", () => {
    const art = { animal: "fox", bg: "peach", ground: "grass", rare: false };
    expect(parseProps("bookmark_shown", { art }).props).toEqual({ art });
  });

  it("keeps the E-07 challenge props, null included (taxonomy v1.5: null off the challenge route)", () => {
    expect(parseProps("bookmark_shown", { challenge_rule: 19, challenge_genre: "과학 교양" }).props).toEqual({ challenge_rule: 19, challenge_genre: "과학 교양" });
    expect(parseProps("bookmark_shown", { challenge_rule: null, challenge_genre: null }).props).toEqual({ challenge_rule: null, challenge_genre: null });
    expect(parseProps("bookmark_shown", { challenge_rule: "19", challenge_genre: 3 }).dropped).toEqual(["challenge_rule", "challenge_genre"]);
  });
});

describe("forAmplitude (taxonomy 2-7: Supabase-only props stay out of the Amplitude copy)", () => {
  it("passes every other event's props through", () => {
    expect(forAmplitude("bookmark_reacted", reacted)).toEqual(reacted);
    expect(forAmplitude("site_visited", {})).toEqual({});
  });

  it("F-26: leaves out the 갈피 우체통 letter and keeps its length (E-31, v0.10)", () => {
    expect(forAmplitude("feedback_sent", { feedback_text: "좋았어요", text_length: 4 })).toEqual({ text_length: 4 });
  });

  it("keeps only the keys the event's spec defines (allowlist): unknown keys never reach Amplitude", () => {
    const sent = { node_id: "start", kind: "narrow", choice: "A", depth: 1, position: 1, elapsed_ms: 5, note: "free text", constructor: "c" };
    expect(forAmplitude("question_answered", sent)).toEqual({ node_id: "start", kind: "narrow", choice: "A", depth: 1, position: 1, elapsed_ms: 5 });
    expect(forAmplitude("entry_selected", { entry: "target", anything: 1 })).toEqual({});
  });
});
