/** docs/balance-game.md 2절 — wording and sides verbatim. The second question of each axis puts A on the right. */
export interface BalanceQuestion { n: number; text: string; a: string; b: string; aOnLeft: boolean }

export const QUESTIONS: readonly BalanceQuestion[] = [
  { n: 1, text: "책을 덮은 뒤, 남았으면 하는 건?", a: "몽글몽글 따뜻함", b: "한동안 멍한 여운", aOnLeft: true },
  { n: 2, text: "딱 하나만 가질 수 있다면?", a: "밑줄 긋고 싶은 문장", b: "다음 장이 궁금해 못 자는 밤", aOnLeft: true },
  { n: 3, text: "다 읽고 난 나는?", a: "뭔가 하나 알게 된 나", b: "마음이 조금 달라진 나", aOnLeft: true },
  { n: 4, text: "책 속 세상은?", a: "옆집 이야기 같은 현실", b: "여기 없는 딴 세상", aOnLeft: true },
  { n: 5, text: "비 오는 날 창가에서 펼칠 책은?", a: "담요처럼 포근한 책", b: "빗소리처럼 쓸쓸한 책", aOnLeft: false },
  { n: 6, text: "친구에게 책을 권할 때 내가 할 말은?", a: "\"이 문장 좀 봐\"", b: "\"앉은 자리에서 다 읽었어\"", aOnLeft: false },
  { n: 7, text: "책을 덮고 제일 먼저 하고 싶은 건?", a: "누군가에게 알려주기", b: "조용히 곱씹어 보기", aOnLeft: false },
  { n: 8, text: "여행을 떠난다면 어디로?", a: "골목 구석구석 동네 여행", b: "아무도 안 가본 낯선 행성", aOnLeft: false },
  { n: 9, text: "오늘 가방에 넣을 책은?", a: "쏙 들어가는 얇은 책", b: "든든하게 두꺼운 책", aOnLeft: true },
];
