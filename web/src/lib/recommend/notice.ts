export const EXHAUSTED_NOTICE = "조건에 딱 맞는 책은 여기까지예요";

/** docs/target-chips.md 3절: be honest when few books match a free-text goal. */
export function coverageNotice(found: number, keyword: string, topic: string): string | null {
  if (found >= 4) return null;
  if (found > 0) return `${keyword} 책은 아직 ${found}권이에요. 나머지는 가까운 '${topic}' 책이에요`;
  return `아직 ${keyword} 책이 없어요. 가장 가까운 '${topic}' 책을 펼칠게요`;
}
