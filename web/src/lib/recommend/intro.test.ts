import { describe, expect, it } from "vitest";
import { truncateIntro } from "./intro";

const s = (n: number, end = ".") => "가".repeat(n - 1) + end;

describe("truncateIntro", () => {
  it("keeps whole sentences until it passes 120 characters", () => {
    const text = `${s(60)} ${s(70)} ${s(50)}`;
    const out = truncateIntro(text);
    expect(out.text).toBe(`${s(60)} ${s(70)}`);
    expect(out.truncated).toBe(true);
  });
  it("returns short text unchanged", () => {
    expect(truncateIntro("짧은 소개예요.")).toEqual({ text: "짧은 소개예요.", truncated: false });
  });
  it("cuts a first sentence longer than 200 characters at 150 with an ellipsis", () => {
    const out = truncateIntro(`${s(230)} ${s(20)}`);
    expect(out.text).toBe(`${"가".repeat(150)}…`);
    expect(out.truncated).toBe(true);
  });
  it("handles empty text", () => {
    expect(truncateIntro("")).toEqual({ text: "", truncated: false });
  });
  it("normalises whitespace and keeps closing quotes with the sentence", () => {
    const out = truncateIntro(`“${"나".repeat(130)}!”\n\n다음 문장.`);
    expect(out.text).toBe(`“${"나".repeat(130)}!”`);
  });
  it("never splits inside Node.js or 3.12", () => {
    const text = "Node.js 3.12 버전을 다룹니다. 두 번째 문장.";
    expect(truncateIntro(text)).toEqual({ text, truncated: false });
  });
  it("keeps Node.js and 3.12 intact when truncating", () => {
    const first = `Node.js 3.12 ${"가".repeat(110)}.`;
    const out = truncateIntro(`${first} 다음 문장입니다.`);
    expect(out).toEqual({ text: first, truncated: true });
  });
});
