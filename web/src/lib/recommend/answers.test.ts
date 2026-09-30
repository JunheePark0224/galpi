import { describe, expect, it } from "vitest";
import { leafAnswersFrom } from "./answers";
import type { BalanceChoice } from "./types";

const all = (c: BalanceChoice): BalanceChoice[] => Array(9).fill(c);

describe("leafAnswersFrom", () => {
  it("sums two answers per axis", () => {
    expect(leafAnswersFrom(all("A"))).toEqual({ temp: 2, pull: 2, gain: 2, world: 2, len: 1 });
    expect(leafAnswersFrom(all("B"))).toEqual({ temp: -2, pull: -2, gain: -2, world: -2, len: -1 });
  });

  it("treats a split pair as 0 and unsure as 0", () => {
    const c: BalanceChoice[] = ["A", "A", "unsure", "B", "B", "unsure", "unsure", "B", "unsure"];
    expect(leafAnswersFrom(c)).toEqual({ temp: 0, pull: 1, gain: 0, world: -2, len: 0 });
  });

  it("requires exactly 9 answers", () => {
    expect(() => leafAnswersFrom(["A"])).toThrow("9 answers");
  });
});
