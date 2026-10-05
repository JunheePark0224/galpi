import type { ArtKind, Tier } from "./combine";

/** The 도감's names for every part (plans/2026-10-05-collection-dex.md 표). Screen words only — never event values. */
export const PART_NAMES: { readonly [K in ArtKind]: Readonly<Record<string, string>> } = {
  animal: {
    cat: "고양이", bear: "곰", rabbit: "토끼", fox: "여우", duck: "오리", whale: "고래", owl: "부엉이",
    redpanda: "레서판다", fennec: "사막여우", otter: "수달", panda: "판다", koala: "코알라",
    bluedragon: "청룡", whitetiger: "백호", redbird: "주작", blacktortoise: "현무",
  },
  bg: {
    peach: "복숭아", leaf: "풀잎", sky: "하늘", butter: "버터", lavender: "라벤더", night: "밤",
    cherry: "벚꽃 언덕", sunset: "노을", aurora: "오로라", galaxy: "은하수", study: "금박 서재",
  },
  sky: {
    moon: "달", cloud: "구름", stars: "별", birds: "새", bigStar: "큰 별",
    rainbow: "무지개", shooting: "별똥별", goldmoon: "금빛 초승달",
  },
  ground: {
    grass: "풀", flowers: "꽃", books: "책 더미", mushroom: "버섯",
    clover: "네잎클로버", firefly: "반딧불", goldbook: "금장 고서",
  },
};

export const TIER_NAMES: Readonly<Record<Tier, string>> = { common: "일반판", limited: "한정판", first_edition: "초판본" };

export function partName(kind: ArtKind, value: string): string {
  return PART_NAMES[kind][value] ?? value;
}
