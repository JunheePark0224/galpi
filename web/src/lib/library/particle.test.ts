import { describe, expect, it } from "vitest";
import { toParticle } from "./particle";

describe("toParticle — '{rod}'(으)로", () => {
  it.each([
    ["읽을 책", "으로"], ["마음에 남은", "으로"], ["첫 막대", "로"], ["서점 가서 볼 책", "으로"],
    ["다시 읽기", "로"], ["여름 서재", "로"], ["가을 하늘", "로"], ["밤에 읽을 글", "로"], ["  밤 ", "으로"],
    ["읽기 완료!", "(으)로"], ["2026", "(으)로"], ["SF", "(으)로"], ["", "(으)로"],
  ])("%s → %s", (name, particle) => {
    expect(toParticle(name)).toBe(particle);
  });
});
