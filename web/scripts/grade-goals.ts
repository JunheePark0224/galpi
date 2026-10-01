/**
 * PHASES P4 완료 기준 "직접 쓰기 예시 30개 채점표" (target-chips 6절 배포 전 검증).
 * Sends 30 example notes to a RUNNING app's /api/goal/classify and writes docs/goal-grading.md for a person to grade.
 *
 *   1. web/.env.local has ANTHROPIC_API_KEY (otherwise every row says "word" and the table only grades word matching)
 *   2. terminal A: npm run dev        terminal B: npm run goal:grade      (GRADE_BASE=http://localhost:3000 by default)
 *
 * Paced under the route's limit (10 a minute → one note every 6.5 s, about 3 minutes for all 30). Only these example notes go to Anthropic — no visitor data.
 */
import { writeFileSync } from "node:fs";

const BASE = process.env.GRADE_BASE ?? "http://localhost:3000";
const PAUSE_MS = 6500;          // 60 000 / 6 500 ≈ 9.2 a minute, under the route's 10
const OUT = new URL("../../docs/goal-grading.md", import.meta.url);

/**
 * [note, the topic a person would expect ("—" = none of ours: the answer should say matched=false)].
 * 10-01 pilot: the six new topics are on, so 번아웃·불안 → 마음 돌보기, 발표 → 대화·관계, 주식 → 돈 관리·투자.
 */
export const EXAMPLES: readonly [string, string][] = [
  ["SQL", "데이터 분석"], ["엑셀 함수", "업무 자동화"], ["데이터 분석 입문", "데이터 분석"], ["파이썬으로 데이터 정리", "데이터 분석"],
  ["그래프 잘 그리는 법", "데이터 분석"], ["통계 기초", "통계"], ["회귀분석이 뭔지", "통계"], ["확률이 어려워요", "통계"],
  ["A/B 테스트 결과 읽기", "통계"], ["p값이 헷갈려요", "통계"], ["챗GPT 잘 쓰는 법", "AI 활용"], ["프롬프트 쓰는 요령", "AI 활용"],
  ["클로드로 코딩", "AI 활용"], ["AI 에이전트 만들기", "AI 활용"], ["업무 자동화", "업무 자동화"], ["파이썬으로 반복 업무 줄이기", "업무 자동화"],
  ["코파일럿 쓰는 법", "업무 자동화"], ["보고서를 AI로 빨리", "업무 자동화"], ["아침 루틴 만들기", "습관·집중"], ["집중이 안 돼요", "습관·집중"],
  ["번아웃", "마음 돌보기"], ["스마트폰 그만 보기", "습관·집중"], ["불안할 때 읽을 책", "마음 돌보기"], ["시간 관리", "시간·생산성"],
  ["일 잘하는 법", "시간·생산성"], ["발표 준비", "대화·관계"], ["메모하는 습관", "시간·생산성"], ["요리 레시피", "—"],
  ["해리포터", "—"], ["주식 투자 입문", "돈 관리·투자"],
];

interface Goal { topic: string; keywords: string[]; matched: boolean; method: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function classify(text: string): Promise<Goal | string> {
  try {
    const res = await fetch(`${BASE}/api/goal/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE },
      body: JSON.stringify({ text }),
    });
    return res.ok ? ((await res.json()) as Goal) : `HTTP ${res.status}`;
  } catch (err) {
    return (err as Error).message;
  }
}

async function main() {
  const rows: string[] = [];
  let llm = 0;
  let same = 0;
  for (const [i, [text, expected]] of EXAMPLES.entries()) {
    const goal = await classify(text);
    if (typeof goal === "string") throw new Error(`${text}: ${goal} — is the app running at ${BASE}?`);
    if (goal.method === "llm") llm++;
    const got = goal.matched ? goal.topic : "—";
    if (got === expected) same++;
    rows.push(`| ${i + 1} | ${text} | ${expected} | ${goal.matched ? goal.topic : `(${goal.topic})`} | ${goal.keywords.join(", ") || "—"} | ${goal.method} |  |`);
    process.stdout.write(`${i + 1}/${EXAMPLES.length}\r`);
    if (i < EXAMPLES.length - 1) await sleep(PAUSE_MS);
  }
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(OUT, [
    "# 직접 쓰기 분류 채점표 (P4 완료 기준)",
    "",
    `${today} · \`npm run goal:grade\` (\`web/scripts/grade-goals.ts\`) · 연결 방법 llm ${llm}/${EXAMPLES.length} · 기대 주제와 같음 ${same}/${EXAMPLES.length} (기계 비교 — 판정은 사람이 "채점" 칸에)`,
    "",
    "> 이 30개는 지시문을 고칠 때 본 예시라 표본 안 수치 — 처음 보는 글에 대한 정확도는 아님(따로 확인).",
    "",
    "채점: O = 맞게 연결 · △ = 주제는 맞고 키워드가 아쉬움 · X = 틀림. \"기대\"가 —이면 우리 목록 밖이라 `찾음 아님`이 맞는 답. 괄호 주제 = 못 찾아서 가장 가까운 추정.",
    "",
    "| # | 직접 쓴 말 | 기대 주제 | 연결 주제 | 키워드 | 방법 | 채점 |",
    "|---|---|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n"));
  console.log(`\nwrote docs/goal-grading.md — llm ${llm}/${EXAMPLES.length}, same topic ${same}/${EXAMPLES.length}`);
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exitCode = 1;
});
