import type { Entry, Way } from "../recommend/types";

/** docs/plans/2026-09-30-d3-tags.md — topic → field. For 🎯 books genre === topic. */
export const FIELD_OF_TOPIC = {
  "데이터 분석": "데이터·통계",
  통계: "데이터·통계",
  "AI 활용": "AI·IT 활용",
  "업무 자동화": "AI·IT 활용",
  "습관·집중": "습관·자기계발",
  "시간·생산성": "습관·자기계발",
} as const;
export type Topic = keyof typeof FIELD_OF_TOPIC;
export type Field = (typeof FIELD_OF_TOPIC)[Topic];

/** docs/target-chips.md 1절 — chip order and labels. Only "AI 활용" is shown with another label. */
export const TOPIC_CHIPS: readonly { topic: Topic; label: string }[] = [
  { topic: "데이터 분석", label: "데이터 분석" },
  { topic: "통계", label: "통계" },
  { topic: "AI 활용", label: "AI 똑똑하게 쓰기" },
  { topic: "업무 자동화", label: "업무 자동화" },
  { topic: "습관·집중", label: "습관·집중" },
  { topic: "시간·생산성", label: "시간·생산성" },
];
export const TOPICS: readonly Topic[] = TOPIC_CHIPS.map((c) => c.topic);

/** docs/book-pool.md 1절 */
export const LEAF_GENRES = ["한국 소설", "외국 소설", "SF·판타지", "추리·스릴러", "에세이", "시", "인문", "과학 교양", "예술·여행"] as const;
export type LeafGenre = (typeof LEAF_GENRES)[number];

export const WAYS: readonly Way[] = ["개념", "실습", "사례"];

const GENRE_TONE: Record<LeafGenre, string> = {
  "한국 소설": "--genre-korean-fiction", "외국 소설": "--genre-world-fiction", "SF·판타지": "--genre-sf-fantasy",
  "추리·스릴러": "--genre-mystery", 에세이: "--genre-essay", 시: "--genre-poetry", 인문: "--genre-humanities",
  "과학 교양": "--genre-science", "예술·여행": "--genre-art-travel",
};
const FIELD_TONE: Record<Field, string> = { "데이터·통계": "--field-data", "AI·IT 활용": "--field-ai", "습관·자기계발": "--field-habit" };

/** DESIGN T-02 — name-tag colours. White text everywhere except 예술·여행 (ink, 5.0 : 1). */
export function toneOf(card: { entry: Entry; genre: string; field: string | null }): { bg: string; fg: string } {
  if (card.entry === "target") {
    return { bg: `var(${FIELD_TONE[card.field as Field] ?? "--ink-muted"})`, fg: "#FFFFFF" };
  }
  const tone = GENRE_TONE[card.genre as LeafGenre] ?? "--ink-muted";
  return { bg: `var(${tone})`, fg: card.genre === "예술·여행" ? "var(--ink)" : "#FFFFFF" };
}
