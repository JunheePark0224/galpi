import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/lib/recommend";
import { IDENTITY_ORDER, inQuestionOrder, questionOrder } from "./order";

const sameAxis = (a: number, b: number) => a < 8 && b < 8 && a % 4 === b % 4;

describe("questionOrder — the nine questions in a new order every pass (10-02)", () => {
  it("is always all nine questions once, never two of one axis side by side", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const order = questionOrder(mulberry32(seed));
      expect([...order].sort((a, b) => a - b)).toEqual(IDENTITY_ORDER);
      for (let k = 1; k < order.length; k++) expect(sameAxis(order[k - 1], order[k]), `seed ${seed}: ${order}`).toBe(false);
    }
  });

  it("really varies: many different orders, and each question shows up first sometimes", () => {
    const orders = Array.from({ length: 300 }, (_, i) => questionOrder(mulberry32(i + 1)).join(","));
    expect(new Set(orders).size).toBeGreaterThan(250);
    const firsts = new Set(orders.map((o) => o.split(",")[0]));
    expect(firsts.size).toBe(9);
  });
});

describe("inQuestionOrder — answers back in question-number order (scores, first page and E-06 read them so)", () => {
  it("puts each answer at its question's place", () => {
    const order = [4, 0, 5, 1, 6, 2, 7, 3, 8];
    const shown = ["A", "B", "unsure", "A", "B", "A", "B", "A", "B"] as const;
    expect(inQuestionOrder(order, [...shown])).toEqual(["B", "A", "A", "A", "A", "unsure", "B", "B", "B"]);
  });

  it("leaves the identity order as it was", () => {
    const shown = ["A", "B", "A", "B", "A", "B", "A", "B", "unsure"] as const;
    expect(inQuestionOrder(IDENTITY_ORDER, [...shown])).toEqual([...shown]);
  });
});
