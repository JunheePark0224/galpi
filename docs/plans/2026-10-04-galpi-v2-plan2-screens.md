# 갈피 v2 계획 2 — 화면·이벤트·🎯 입력 없애기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 입구 하나(S-01) → 질문 지도를 따라가는 갈림길(S-02) → "당신이 고른 길"(S-04)로 흐름을 바꾸고, 서버 뽑기를 질문 답으로 돌리고, 이벤트를 taxonomy v1.0으로 옮기고, 🎯 입력(칩·직접 쓰기·Claude 분류·F-24)을 코드에서 없앤다.

**Architecture:** 계획 1의 순수 엔진(`web/src/lib/paths/`)에 S-04 요약(`pathSummary`)·나온 이유(`pathReason`)·지도 상수(`QUESTION_MAP`)를 더하고, 서버(`/api/books/draw`)는 답 목록 `{ node, choice }[]`을 받아 `walkPath` → `drawForPath`로 다섯 장을 뽑는다(카드 모양은 그대로). 화면 쪽은 `lib/flow/path.ts`(지도 위 다음 질문·공통 속성·완성 속성)와 리듀서가 `answers` 목록 하나로 흐름을 움직이고(되돌리기 = 마지막 답 하나 빼기), 표시만 하는 `Question`·`PathPage` 컴포넌트를 `Flow`가 묶는다. 이벤트는 문서 → csv → `schema.ts` → 테스트 → `track()`을 한 커밋(Task 6)에서 바꾼다.

**Tech Stack:** Next.js 16 (App Router, `web/`), React 19, TypeScript, Motion, Vitest(+v8 coverage), Playwright. 새 의존성 없음 — `@anthropic-ai/sdk`는 뺀다.

**Spec:** `docs/plans/2026-10-04-galpi-v2-paths-design.md` (전 절, 특히 **10절 시안 결정** — 이 계획과 다르면 10절이 이긴다). 엔진: `docs/plans/2026-10-04-galpi-v2-plan1-engine.md`(완료·병합). 지도: `docs/question-map.md` → `web/src/data/question-map.json`.

**이 계획 밖:** 계획 3 — 매일 책 작업을 "모자란 길 끝 채우기"로(`src/pipeline/gaps.py`), 시뮬레이션 확장. 책갈피 색·동물 늘리기(10절, 나중).

## Global Constraints

- **선택지는 늘 둘(A·B) + "갈피를 못 잡겠어요"(unsure, 0.8초 꾹 누르기)** — 모든 질문. 화면은 A 왼쪽, B 오른쪽.
- **질문하는 동안 지나온 길·몇 번째 질문을 보여 주지 않는다**(10절). "n / 9" 막대·숫자 없음. 지나온 길은 S-04에서 처음 보인다.
- S-04: "당신이 고른 길"(지나온 길 + 기분). **책 수 안내 없음**(모자라면 조용히 넓혀 채움). 도전이면 한 줄 **"평소의 당신과 반대편에서 골랐어요"**. **도전 책갈피를 따로 꾸미지 않는다**.
- S-01: 입구 버튼 하나 **[갈피 잡으러 가기]** + 아래 한 줄 **"질문 몇 개면 한 권을 만나요"**. 서재 권수·우체통 그대로.
- 모든 질문에 **[← 이전 질문]**(첫 질문에서는 S-01). S-04에는 **[← 질문으로 돌아가기]**(마지막 질문으로; 같은 답이면 같은 다섯 장, 답을 바꾸면 새로 뽑음).
- 뽑기·추천 로직은 화면과 떨어진 **순수 함수 + 테스트 100%** (`src/lib/recommend/**`, `src/lib/paths/**` 커버리지 임계 100% 유지). `lib/recommend`의 동작은 바꾸지 않는다.
- **직접 쓴 글을 더는 받지 않는다**(우체통 F-26 글과 막대 이름은 그대로). 사이트의 Claude(Anthropic) 호출 0 — 매일 책 파이프라인(`src/pipeline/`, Python, GitHub Actions)은 건드리지 않는다.
- **이벤트 원칙 3-1**: 이벤트를 추가·변경·삭제하면 `docs/taxonomy.md` → `docs/taxonomy.csv` → `web/src/lib/track/schema.ts` → 테스트 → `track()` 호출을 **같은 커밋**에서. taxonomy 테스트가 실패하면 문서와 코드 중 어느 쪽이 틀렸는지 보고 고친다(테스트를 고쳐 통과시키지 않는다).
- **모으는 정보가 바뀌면 `/privacy`를 먼저**(Task 2가 Task 6보다 앞). 이 계획은 한 브랜치에서 실행하고 Task 9 뒤에 한 번에 병합·배포하므로, 처리방침이 기능보다 먼저 공개되거나 늦게 공개되는 배포는 없다.
- **모든 장르를 위해 설계한다** — 책이 0권인 장르·주제·키워드도 지도와 검사에서 빼지 않는다(`MAP_GENRES`, `validateMap` 그대로). 책이 모자라면 엔진이 넓혀 채운다.
- 한 화면에 주 버튼 하나, 누르는 곳 44px 이상. 화면 문구는 한국어, 코드·커밋은 영어. 새 화면 문구는 `docs/context.md`에 날짜와 함께 남긴다.
- Next 16은 학습 데이터와 다르다: 프레임워크 API(라우트 핸들러·page·metadata)를 건드리는 단계에서는 먼저 `web/node_modules/next/dist/docs/`의 해당 문서를 읽는다(각 단계에 경로를 적었다).
- 명령은 `web/`에서(`cd web`). Python을 돌리면 `PYTHONIOENCODING=utf-8`.
- 커밋 끝 줄: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. 본문에 체크리스트 한 줄을 **사실대로**: 이벤트를 안 바꾼 커밋은 `- [x] events: no event change`, Task 6은 `- [x] events: taxonomy.md · taxonomy.csv · schema.ts changed together`.
- 작업 위치: `git worktree add .worktrees/v2-screens -b feat/v2-screens` (CLAUDE.md: worktree는 `.worktrees/<이름>`에만). 병합·배포는 사용자 승인 뒤.
- E2E는 Task 6~7 동안 옛 입구를 누르는 스펙이 깨진 채로 있다(의도). Task 8에서 모두 고치고, Task 9 전에는 병합하지 않는다. vitest·tsc·lint는 **모든 커밋에서 초록**.

## File Structure

| 파일 | 책임 | Task |
|---|---|---|
| `docs/proposal.md` · `PRD.md` · `DESIGN.md` · `balance-game.md` · `target-chips.md` · `context.md` | v2 정체성·기능·디자인 문서 | 1 |
| `web/src/app/privacy/page.tsx` · `page.test.tsx` · `web/src/lib/privacy.ts` · `web/e2e/privacy.spec.ts` · `docs/taxonomy.md` 6-3f | 처리방침 v2 (직접 쓴 글·Anthropic 없음, 질문 답 기록) | 2 |
| `web/src/lib/paths/map.ts` | `QUESTION_MAP` — 빌드된 지도 JSON 하나 | 3 |
| `web/src/lib/paths/summary.ts` | `pathSummary` — S-04 지나온 길·기분·모드 | 3 |
| `web/src/lib/paths/reason.ts` | `pathReason` — 길의 범위·기분으로 "나온 이유" | 3 |
| `web/src/lib/paths/__fixtures__/paths.ts` | 실제 지도 위 시험용 길 3개(SQL·섞어서·도전) | 3 |
| `web/src/lib/books/types.ts` · `draw.ts` · `request.ts` · `web/src/app/api/books/draw/route.ts` | 서버 뽑기: 답 목록 검사 → 다섯 장 + `path` | 4 (옛 모양 제거 7) |
| `web/src/lib/flow/path.ts` | 화면용 지도 도우미: 다음 질문·저장 검사·같은 답·공통 속성·완성 속성 | 5 |
| `web/src/components/flow/Question.tsx` · `.module.css` | S-02 질문 화면(표시만, 기록은 Flow) | 5 |
| `web/src/components/flow/PathPage.tsx` · `FirstPage.module.css` | S-04 오른쪽 쪽 "당신이 고른 길" | 5 |
| `docs/taxonomy.md` · `docs/taxonomy.csv` · `web/src/lib/track/schema.ts` · `common.ts` · `amplitude.ts` + 테스트 | taxonomy v1.0 | 6 |
| `web/src/lib/flow/state.ts` · `storage.ts` · `api.ts` | 리듀서(answers)·저장 v6·뽑기 요청 | 6 |
| `web/src/components/flow/Flow.tsx` · `Home.tsx` · `BookScene.tsx` · `FirstPage.tsx` · `FlowRoot.tsx` · `web/src/app/page.tsx` | 화면 연결 | 6 |
| (삭제) `TargetInput.*` · `BalanceGame.*` · `lib/flow/{order,questions,summary,target}.*` · `FirstPage.test.tsx` · `e2e/{flow-leaf,flow-target,understood}.spec.ts` | 옛 입력 화면 | 6 |
| (삭제) `lib/goal/*` · `app/api/goal/*` · `lib/server/llm.*` · `Understood.*` · `lib/flow/examples.*` · `lib/books/active.*` · `scripts/grade-goals.ts` | 🎯 분류·Anthropic | 7 |
| `web/e2e/helpers.ts` · `web/e2e/flow-path.spec.ts`(새) · 나머지 스펙 | 갈림길 E2E·스크린샷 | 8 |
| `docs/HANDOFF.md` · `docs/tasks.md` · `docs/context.md` | 마무리 기록 | 9 |

---

### Task 1: 문서 v2 — 정체성·PRD·DESIGN

**Files:**
- Modify: `docs/proposal.md`, `docs/PRD.md`, `docs/DESIGN.md`, `docs/balance-game.md`, `docs/target-chips.md`, `docs/context.md`

**Interfaces:**
- Consumes: 설계 문서 1·2·3·4·6·10절.
- Produces: PRD v2의 ID — F-01·F-03·F-05·F-07·F-16 바뀜, F-02·F-24·F-25 삭제, S-01·S-02·S-04 바뀜, E-32 `question_answered`·E-33 `question_back_clicked`·E-34 `path_completed`, E-03·E-06·E-21·E-22·E-24·E-26 삭제. DESIGN C-07·C-10 바뀜, C-09·C-17(이렇게 이해했어요) 삭제, C-23 새로. 이후 Task가 이 ID를 쓴다.

- [ ] **Step 1: proposal.md 정체성**

`docs/proposal.md`에서:
1. 표 `| 2026-09-29 | … | **초안 v3 — 검토 전** …|` 아래, `> **갈피의 용도 (09-29 확정)**` 블록 **위에** 새 줄을 넣는다:

```markdown
> **v2 (2026-10-04, `plans/2026-10-04-galpi-v2-paths-design.md`)** — **갈피를 못 잡은 사람이 둘 중 하나를 고르는 질문에 답하며 갈피를 잡고, 원하던 책이나 운명 같은 책 한 권을 만나는 웹.** 책을 읽는 사람이든 안 읽는 사람이든, 우연히 한 권을 마주쳐 읽게 되는 것이 목표다. 🎯·🍃 두 입구와 🎯 직접 쓰기·AI 분류는 없앴다(친구 시험에서 직접 쓰기 3번 모두 막힘 — 목적이 분명한 검색은 예스24가 더 잘한다).
```

2. 용도 표의 `| 재미있게 만나게 한다 (책 펼치기·책갈피·밸런스 게임) |` → `| 재미있게 만나게 한다 (책 펼치기·책갈피·둘 중 하나 고르는 질문) |`
3. 3줄 요약 2번의 `**칩만 고르면 오래된 책 한 권이 나오고, 펼치면 첫 장에 내 상황이,` → `**둘 중 하나를 고르는 질문 몇 개에 답하면 오래된 책 한 권이 나오고, 펼치면 첫 장에 내가 고른 길이,`
4. 2절 표의 `AI는 글을 우리 목록 안으로 **분류만** 하고(F-02), 어떻게 이해했는지 한 줄로 보인다(F-24)` → `v2부터 사이트는 AI를 부르지 않는다 — 질문 지도(docs/question-map.md)·태그·점수 규칙이 모두 공개 문서다`

- [ ] **Step 2: PRD.md v2**

`docs/PRD.md`를 아래대로 고친다(다른 줄은 그대로).

1. 버전 표에 줄 추가:
```markdown
| v2 | 2026-10-04 | `plans/2026-10-04-galpi-v2-paths-design.md` (사용자 확정 10-04, 10절 시안 결정) | **확정 — 계획 2로** |
```
2. 용도 표 `재미있게 만나게 한다 (책 펼치기·책갈피·밸런스 게임)` → `재미있게 만나게 한다 (책 펼치기·책갈피·둘 중 하나 고르는 질문)`. 그 아래 `태그 기준표(\`balance-game.md\`, \`target-chips.md\`)` → `태그 기준표(\`balance-game.md\`, \`target-chips.md\`)와 질문 지도(\`question-map.md\`)`.
3. 1절 "**언제 쓰나 (10-01)**" 문단 전체를 바꾼다:
```markdown
**언제 쓰나 (v2, 10-04)**: **갈피를 못 잡을 때** — 뭘 읽을지 모를 때, 또는 "SQL을 배우고 싶은데 어떤 책부터 볼지 모를 때"처럼 방향은 있지만 책을 못 고를 때. 둘 중 하나를 고르는 질문에 답하며 갈피를 잡고, 원하던 책이나 운명 같은 책 한 권을 만난다. 특정 책 제목·작가 찾기, 목적이 분명한 검색은 예스24로(원칙 0). AI 챗봇과 다른 점은 공개된 기준(질문 지도·태그·점수 규칙)·실제로 있는 책만·같은 답이면 같은 기준·고르는 재미·추천 효과를 숫자로 잼(`proposal.md`). 사용자 본인의 경험에서 출발한 문제 정의 — 이용자 불만으로 확인된 것은 아님(원칙 4)
```
   바로 아래 문단 `칩만 고르면 오래된 책 한 권이 나오고, 펼치면 첫 장에 내 상황이,` → `둘 중 하나를 고르는 질문 몇 개에 답하면 오래된 책 한 권이 나오고, 펼치면 첫 장에 내가 고른 길이,`
4. 2절 흐름 블록의 `[S-01 …]`부터 `[S-04 첫 장] …` 줄까지를 바꾼다:
```text
[S-01 처음 화면]  입구 하나 [갈피 잡으러 가기] · "질문 몇 개면 한 권을 만나요"      (우측 위: [로그인] 또는 [내 책갈피])
      ↓
[S-02 갈림길]     질문 하나씩, 선택지는 늘 둘(책갈피 모양 카드) · 꾹 누르면 "갈피를 못 잡겠어요" · 왼쪽 위 [← 이전 질문]
                  지나온 길·몇 번째 질문은 보이지 않는다. 질문 수는 사람마다 다름(짧으면 3개, 길면 11개)
      ↓
[S-03 책 등장]    오래된 책 한 권(책갈피 다섯 장이 꽂혀 있다) → 눌러서 펼치기
      ↓
[S-04 첫 장]      "당신이 고른 길" — 지나온 길 + 기분 (도전이면 "평소의 당신과 반대편에서 골랐어요") → [← 질문으로 돌아가기] / [다음 장]
```
5. 3-1 표의 행을 바꾼다:
   - F-01 행 전체:
```markdown
| F-01 | 입구 하나 (v2) | S-01 | 로그인 없이 바로 시작. 버튼 하나 **[갈피 잡으러 가기]**, 아래 한 줄 "질문 몇 개면 한 권을 만나요"(10-04 시안 결정). 누르면 S-02 첫 질문. 서재 권수(F-23)·우체통(F-26)은 그대로. 헤더의 "갈피" 로고를 누르면 언제든 S-01로 돌아온다(10-01) |
```
   - F-02 행 전체:
```markdown
| F-02 | ~~🎯 입력 화면 (칩·직접 쓰기·Claude 분류)~~ | — | **삭제 (v2, 10-04)** — 친구 시험에서 직접 쓰기 3번 모두 범위 밖으로 막힘. 방향이 있는 사람도 F-03 갈림길의 "배우기" 갈래로 좁혀 간다. 🎯 책 276권은 그 갈래의 재료로 그대로 |
```
   - F-03 행 전체:
```markdown
| F-03 | 갈림길 질문 (v2) | S-02 | `docs/question-map.md`(사람이 쓰는 질문 지도)의 질문을 하나씩. **선택지는 늘 둘**(책갈피 모양 카드, A 왼쪽·B 오른쪽, 누르면 바로 다음) + **"갈피를 못 잡겠어요"(0.8초 꾹, 누르는 동안 "끌리는 쪽을 고를수록 더 잘 맞아요")**. 첫 질문 "평소 끌리는 쪽으로 / 오늘은 낯선 쪽으로 도전", 둘째 "이야기에 빠지기 / 뭔가 배우기"(못 잡겠어요 = 섞어서 기분 질문만). 좁히기 질문은 범위를, 기분 질문은 점수를 정한다(설계 3절). 모든 질문 왼쪽 위 **[← 이전 질문]**(첫 질문에서는 S-01). **질문하는 동안 지나온 길·몇 번째 질문은 보여 주지 않는다**(10-04 — 끝나고 S-04에서). 답은 새로고침해도 이어진다 |
```
   - F-05 행의 완료 기준 맨 앞에 넣는다: `**v2 (10-04)**: 범위 = 좁히기 답이 가리키는 태그의 책(도전이면 먼 곳 표로 바꾼 범위), 점수 = 기분 답, 추천 4장 + 운명 1장(마지막으로 좁힌 범위의 바로 윗단계에서, 표시 없음). 모자라면 윗단계로 조용히 넓혀 채운다(책 수 안내 없음). 규칙은 설계 5절·\`web/src/lib/paths/\`. 아래는 v1 기록 — `
   - F-07 행 전체:
```markdown
| F-07 | 첫 장 — 당신이 고른 길 (v2) | S-04 | 왼쪽 쪽 제목 "당신이 고른 길", 오른쪽 쪽에 **지나온 길**(좁히기에서 고른 답 차례로, 없으면 "책장 전체에서")과 **기분**(기분 질문에서 고른 답, 없으면 "기분은 갈피에게 맡겼어요"). 도전이면 맨 위 한 줄 "평소의 당신과 반대편에서 골랐어요". 책 수 안내는 넣지 않는다(10-04). 아래 [← 질문으로 돌아가기](보조 — 마지막 질문으로; 같은 답이면 같은 다섯 장, 바꾸면 새로 뽑음, 횟수 제한 없음) [다음 장](주). 유형 이름은 쓰지 않는다 |
```
   - F-16 행 완료 기준 끝에 덧붙인다: ` **v2 (10-04)**: 직접 쓴 목표 글을 받지 않고 Anthropic 전달도 없어진다고 고침 — 질문 답·되돌린 것·고른 길(평소/도전, 이야기/배우기)을 모은다고 적음. 예전에 적은 글은 1년 자동 삭제로 지워진다고 적음(taxonomy 6-3f)`
   - F-24 행 전체:
```markdown
| F-24 | ~~🎯 "이렇게 이해했어요" (①②③)~~ | — | **삭제 (v2, 10-04)** — 직접 쓰기와 함께 없앰. 사이트의 Claude 호출 0 |
```
6. 3-2 표의 F-25 행 전체: `| F-25 | ~~🎯 목적 좁히기 한 단계~~ | **삭제 (v2)** — 갈림길의 좁히기 질문이 대신한다 |`
7. 4절 공통 속성 줄의 `입구(🎯/🍃)` → `갈래(이야기/배우기 — v2, 값은 v1 입구와 같은 leaf/target)·모드(평소/도전 — v2)`. 이벤트 표:
   - E-02 행: `| E-02 | \`entry_selected\` | 어디서(S-01) — v2부터 S-01 [갈피 잡으러 가기]만 | F-01 |`
   - E-03·E-06·E-21·E-22·E-24·E-26 행: 이벤트 칸을 `~~\`이름\`~~`로 긋고 속성 칸을 `삭제 (taxonomy v1.0, 10-04)`로.
   - E-25 행: `| E-25 | \`unsure_hold_cancelled\` | 질문 id, 길에서 몇 번째 질문인지, 누른 시간 — 꾹 누르다 뗀 것(망설임) | F-03 |`
   - E-20 행: 어디서 `(S-04 / 마무리)` → `(S-04 / 마무리 / S-02 첫 질문의 이전 질문)`
   - 표 끝에 세 줄:
```markdown
| E-32 | `question_answered` | 질문 id, 좁히기/기분, A / B / 못 잡겠어요, 길에서 몇 번째 질문인지, 이 판에서 몇 번째 답인지, 걸린 시간 (v1.0, E-24 대신) | F-03 |
| E-33 | `question_back_clicked` | 다시 답할 질문 id, 그 질문의 자리, 어디서(S-02 / S-04) | F-03·07 |
| E-34 | `path_completed` | 뽑는 범위 id(도전이면 먼 곳), 질문 수, 못 잡겠어요 수 — 모드·갈래는 공통 속성 | F-03·05 |
```
8. 5절 화면 표: S-01 `처음 화면 (입구 하나 [갈피 잡으러 가기], 우측 위 로그인/내 책갈피, 아래 갈피 우체통)`, S-02 `| S-02 | 갈림길 (질문 하나씩) | F-03 |`, S-04 `| S-04 | 첫 장 — 당신이 고른 길 | F-07 |`.
9. 8절 목록 끝에 `- [x] v2 — 입구 하나·둘 중 하나 고르는 갈림길·도전 루트, 🎯 입력·직접 쓰기·AI 분류 없앰 (10-04, \`plans/2026-10-04-galpi-v2-paths-design.md\`)`

- [ ] **Step 3: DESIGN.md**

`docs/DESIGN.md` 3절 표:
- C-07 행 전체:
```markdown
| C-07 | 질문 카드 (v2) | S-02 | 두 선택지 카드 + 가운데 "vs". **카드는 책갈피 모양**(반투명 필름·아치 창·제비꼬리·끈, 09-30) — 아치 창에 선택지 글씨, 동물 없음. A 왼쪽·B 오른쪽. **진행 막대·"n / 9"는 없앰(10-04)** — 지나온 길도 보이지 않는다. 질문 글 20px 고운바탕 가운데 |
```
- C-08 행의 `S-02 🍃` → `S-02 (모든 질문)`.
- C-09 행 전체: `| C-09 | ~~칩 · 입력 칸~~ | — | **삭제 (v2, 10-04)** — 🎯 입력 화면과 함께 |`
- C-10 행 전체:
```markdown
| C-10 | 첫 장 요약 (v2) | S-04 | 왼쪽 쪽: 장식 로고 + 제목 "당신이 고른 길"(22px, 데스크톱 28px). 오른쪽 쪽: 도전이면 맨 위 한 줄 "평소의 당신과 반대편에서 골랐어요"(고운바탕 14px, `cloth` 색) → 작은 이름 "지나온 길"(12px ink-muted) + 좁히기 답 한 줄씩(장부 줄, 없으면 "책장 전체에서") → 작은 이름 "기분" + 기분 답 한 줄씩(없으면 "기분은 갈피에게 맡겼어요"). 책 수 안내 없음(10-04). 책 아래 [← 질문으로 돌아가기](보조) [다음 장](주) |
```
- "C-17 | 이렇게 이해했어요 (F-24)" 행 전체: `| C-17 | ~~이렇게 이해했어요 (F-24)~~ | — | **삭제 (v2, 10-04)** |` (같은 번호의 "막대 (P5)" 행은 그대로)
- C-14 행의 `찾은 책 수,` 를 지운다(남는 쓰임: 책이 없을 때 "조건에 딱 맞는 책은 여기까지예요").
- 표 끝에 새 행:
```markdown
| C-23 | 이전 질문 (v2, 10-04) | S-02 | 질문 위 왼쪽, 글자 버튼 "← 이전 질문"(14px ink-muted, 테두리 없음, 높이 44px). 첫 질문에서는 처음 화면으로. 주 버튼이 아니다 |
```
6절 화면 표:
- S-01 행의 `🎯/🍃 두 입구 카드` → `입구 카드 하나 [갈피 잡으러 가기](C-05 주 버튼 역할) + 아래 한 줄 "질문 몇 개면 한 권을 만나요"(13px ink-muted 가운데)`
- `| S-02 🍃 | C-07, C-08, 진행 막대 |` → `| S-02 | C-23, C-07, C-08 (진행 막대 없음) |`
- `| S-02 🎯 | C-09, C-05 [책 펼치기] |` 행 삭제
- `| S-04 | C-10, C-17(🎯), C-14 |` → `| S-04 | C-10 v2, C-14(책이 없을 때만) |`

- [ ] **Step 4: balance-game.md · target-chips.md 머리 한 줄**

두 파일 제목 바로 아래에 넣는다.
`docs/balance-game.md`:
```markdown
> **v2 (2026-10-04)**: 9문항 밸런스 게임은 `question-map.md`(질문 지도)의 이야기 갈래 기분 질문으로 흡수됐다. 축·점수 규칙(2·3절)은 엔진(`web/src/lib/paths/draw.ts` `moodScore`)이 그대로 쓴다. 이 문서는 v1 기록이다.
```
`docs/target-chips.md`:
```markdown
> **v2 (2026-10-04)**: 🎯 칩·직접 쓰기 입력과 Claude 분류는 없앴다. 주제·키워드 목록과 "새 키워드 정의"는 질문 지도(`question-map.md`)의 배우기 갈래가 그대로 쓴다. 입력 화면 절은 v1 기록이다.
```

- [ ] **Step 5: context.md 결정 기록**

`docs/context.md`의 `Last Updated:` 줄을 `Last Updated: 2026-10-04 — v2 계획 2 (화면·이벤트·🎯 없애기)`로 바꾸고, 의사결정 표 끝(10-04 설계 행 아래)에 넣는다:
```markdown
| 10-04 | v2 계획 2 결정 — ① 질문 답 이벤트는 새 이름 `question_answered`(E-32), 옛 E-24 `balance_answered`는 `removed`로 줄을 남김(SQL에서 v1 9문항과 v2 질문이 한 이름에 섞이지 않게) ② 공통 속성 `entry`는 값 그대로 뜻만 갈래로(leaf=이야기, target=배우기 — v1 입구와 이어 보기), 새 공통 속성 `mode`(normal/challenge), `screen_version` v2 ③ 길 완성(E-34)에는 모드를 따로 싣지 않음(공통 `mode`가 실음, 2-3 공통 이름 재사용 금지) ④ S-04 요약은 서버 뽑기 응답의 `path`로 그림(답과 같은 요청에서 계산) ⑤ 첫 질문의 [← 이전 질문]은 E-20 `home_clicked`(source=question, 새 판) ⑥ 새 문구: "갈피 잡으러 가기", "질문 몇 개면 한 권을 만나요", "이전 질문", "질문으로 돌아가기", "당신이 고른 길", "지나온 길", "기분", "책장 전체에서", "기분은 갈피에게 맡겼어요", "평소의 당신과 반대편에서 골랐어요" | 설계 10절·원칙 3-1. 계획 `plans/2026-10-04-galpi-v2-plan2-screens.md` |
```

- [ ] **Step 6: 확인과 커밋**

Run: `cd .. && git diff --stat`
Expected: 6개 문서만 바뀜 (`docs/proposal.md`, `docs/PRD.md`, `docs/DESIGN.md`, `docs/balance-game.md`, `docs/target-chips.md`, `docs/context.md`).

```bash
git add docs/proposal.md docs/PRD.md docs/DESIGN.md docs/balance-game.md docs/target-chips.md docs/context.md
git commit -m "docs: Galpi v2 — one entry, two-way questions, PRD v2 and design updates

- [x] events: no event change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 처리방침 v2 (먼저)

**Files:**
- Modify: `web/src/app/privacy/page.tsx`, `web/src/app/privacy/page.test.tsx`, `web/src/lib/privacy.ts`, `web/e2e/privacy.spec.ts`, `docs/taxonomy.md` (6-3f 절만 — 이벤트 변경 없음)

**Interfaces:**
- Consumes: 지금 처리방침(🎯 글 행, Anthropic 문단, 예스24 검색어 문단).
- Produces: 표 9행(머리 포함 10행). Task 8의 `privacy.spec.ts`가 이 수를 센다.

먼저 읽기: `web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` (page 파일 규칙 — export는 default와 metadata만).

- [ ] **Step 1: 실패하는 테스트로 바꾸기**

`web/src/app/privacy/page.test.tsx`에서:
1. 첫 테스트(`"shows the title, the date and the nine collected items"`)를 통째로 바꾼다:
```tsx
  it("shows the title, the date and the nine collected items (v2: no written goal)", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "개인정보 처리방침" })).toBeInTheDocument();
    expect(screen.getByText(/2026-10-04/)).toBeInTheDocument();
    expect(screen.getByText("갈피는 이름·전화번호를 받지 않아요.")).toBeInTheDocument();
    expect(screen.getByText(/이메일·닉네임은 로그인할 때 로그인 확인용으로 로그인 서비스에만 남고, 갈피는 쓰지 않아요\./)).toBeInTheDocument();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(10); // header + 9 (v2: the 🎯 written-goal row is gone)
    expect(screen.getByRole("columnheader", { name: "모으는 것" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "왜" })).toBeInTheDocument();
    expect(screen.getByText(ACTIONS)).toBeInTheDocument();
    expect(screen.getByText("기기 종류(휴대폰/컴퓨터), 앱 안 브라우저 여부, 들어온 곳(이전 페이지 주소), 화면 버전")).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: /무엇을 알고 싶어요/ })).toBeNull();
    expect(screen.getByText("같은 사람이 다시 왔는지 세기 위해")).toBeInTheDocument();
    expect(screen.getByText("추천이 잘 맞는지 분석하기 위해")).toBeInTheDocument();
    expect(screen.getByText("화면이 잘 동작하는지 확인하기 위해")).toBeInTheDocument();
  });
```
   그리고 파일 맨 위 import 아래에 상수를 넣는다:
```tsx
const ACTIONS = "누른 버튼과 누른 시각, 질문마다 고른 답(둘 중 하나 또는 \"갈피를 못 잡겠어요\")과 답하는 데 걸린 시간, 이전 질문으로 되돌린 것, 고른 길(평소/도전, 이야기/배우기), 본 책갈피, 궁금해요/패스, 몇 번째 뽑기인지";
```
2. 세 테스트를 지운다: `"says the written goal stays in Galpi's database…"`, `"names Anthropic as where the written goal goes…"`, `"says the YES24 search link sends only the short missing phrase…"`. 그 자리에 넣는다:
```tsx
  it("says no written goal is taken and nothing goes to Anthropic any more, and what happens to old notes (v2, taxonomy 6-3f)", () => {
    render(<PrivacyPage />);
    expect(screen.queryByText(/Anthropic에 보내요/)).toBeNull();
    expect(screen.queryByText(/예스24에서 찾기/)).toBeNull();
    const old = screen.getByText("이제 갈피는 직접 쓴 목표 글을 받지 않고, 어떤 글도 AI 서비스(Anthropic)에 보내지 않아요.");
    expect(old.tagName).toBe("STRONG");
    expect(old.closest("p")).toHaveTextContent("예전 화면의 🎯 \"무엇을 알고 싶어요\" 칸에 적은 글은 갈피의 데이터베이스에만 남아 있다가, 수집일로부터 1년이 지나면 다른 기록과 함께 지워져요.");
    expect(screen.getByText(/이 밖의 곳에는 주지 않아요\./)).toBeInTheDocument();
  });
```
3. `"says the letter is not sent to Amplitude…"` 테스트의 `"갈피 우체통에 적은 글도 Amplitude에 보내지 않고, …"` 를 `"갈피 우체통에 적은 글은 Amplitude에 보내지 않고, 갈피의 데이터베이스(Supabase)에만 저장해요."` 로.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/app/privacy/page.test.tsx`
Expected: FAIL — 행 수 11, 날짜 2026-10-02, 옛 문장.

- [ ] **Step 3: 처리방침 고치기**

`web/src/lib/privacy.ts`: `export const UPDATED = "2026-10-04";`

`web/src/app/privacy/page.tsx`:
1. 맨 위 문서 주석을 바꾼다:
```tsx
/**
 * S-10 (F-16): what is collected and where it goes — Amplitude, (P5, taxonomy 6-3d) login, the Google email kept by the
 * login service only, 내 책갈피, (F-26, taxonomy 6-3e) the 갈피 우체통 letter — Supabase only, a time-only notice email
 * through Resend. v2 (taxonomy 6-3f): no written goal, nothing to Anthropic; question answers instead of the balance game.
 */
```
2. 표 둘째 행의 첫 칸을 바꾼다:
```tsx
            <td>누른 버튼과 누른 시각, 질문마다 고른 답(둘 중 하나 또는 {"\"갈피를 못 잡겠어요\""})과 답하는 데 걸린 시간, 이전 질문으로 되돌린 것, 고른 길(평소/도전, 이야기/배우기), 본 책갈피, 궁금해요/패스, 몇 번째 뽑기인지</td>
```
3. 표의 `🎯 {"\"무엇을 알고 싶어요\""} 칸에 적은 글 …` 행(`<tr>` 하나)을 통째로 지운다.
4. "기록을 전달하는 곳" 절:
   - 첫 `<p>`를 바꾼다:
```tsx
        <p>
          위 기록은 분석 서비스 Amplitude(서버는 미국에 있어요)에도 보내요.{" "}
          Amplitude는 브라우저의 쿠키와 저장 공간에 식별 값을 남겨요.
        </p>
        <p>
          <strong>이제 갈피는 직접 쓴 목표 글을 받지 않고, 어떤 글도 AI 서비스(Anthropic)에 보내지 않아요.</strong>{" "}
          예전 화면의 🎯 {"\"무엇을 알고 싶어요\""} 칸에 적은 글은 갈피의 데이터베이스에만 남아 있다가, 수집일로부터 1년이 지나면 다른 기록과 함께 지워져요.
        </p>
```
   - Anthropic 문단(`<strong>🎯 … Anthropic(AI 서비스 Claude, …`로 시작하는 `<p>`)과 예스24 검색어 문단(`<strong>첫 장에서 [예스24에서 찾기]를 누르면…`)을 지운다.
   - 우체통 문단의 `갈피 우체통에 적은 글도 Amplitude에` → `갈피 우체통에 적은 글은 Amplitude에`.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/app/privacy/page.test.tsx`
Expected: PASS.

- [ ] **Step 5: E2E 행 수와 taxonomy 6-3f**

`web/e2e/privacy.spec.ts`: `toHaveCount(11);   // header + 10 …` → `toHaveCount(10);   // header + 9 (v2: no written-goal row)`.

`docs/taxonomy.md` 6-3e 절 바로 아래에 새 절(이벤트 변경 없음):
```markdown
### 6-3f. 처리방침 변경 — v2 (직접 쓴 글·Anthropic 없음, v1.0)

7-1의 7단계대로 **화면보다 먼저** `/privacy`를 고쳤다(갱신일 2026-10-04). ① 표의 행동 기록 행을 "질문마다 고른 답(둘 중 하나 또는 갈피를 못 잡겠어요)과 답하는 데 걸린 시간, 이전 질문으로 되돌린 것, 고른 길(평소/도전, 이야기/배우기)"로 ② 🎯 직접 쓴 글 행을 지움 ③ Anthropic 문단·예스24 검색어 문단을 지우고 "이제 직접 쓴 목표 글을 받지 않고 어떤 글도 Anthropic에 보내지 않는다, 예전 글은 1년 자동 삭제로 지워진다"는 문단을 넣음. 이미 쌓인 `goal_text`·`missing_text`는 `0002_retention.sql`이 1년 뒤 지운다.
```

- [ ] **Step 6: 전체 단위 테스트·커밋**

Run: `npx vitest run`
Expected: PASS (모든 파일).

```bash
git add web/src/app/privacy/page.tsx web/src/app/privacy/page.test.tsx web/src/lib/privacy.ts web/e2e/privacy.spec.ts docs/taxonomy.md
git commit -m "feat(privacy): v2 policy — no written goals, nothing to Anthropic, question answers

- [x] events: no event change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 엔진 더하기 — 지도 상수·S-04 요약·나온 이유

**Files:**
- Create: `web/src/lib/paths/map.ts`, `web/src/lib/paths/summary.ts`, `web/src/lib/paths/reason.ts`, `web/src/lib/paths/__fixtures__/paths.ts`
- Test: `web/src/lib/paths/summary.test.ts`, `web/src/lib/paths/reason.test.ts`
- Modify: `web/src/lib/paths/index.ts`, `web/src/lib/paths/data.test.ts`

**Interfaces:**
- Consumes: `walkPath(map: QuestionMap, answers: Answer[]): Walked`, `Walked { scope, mood, mode, crumbs, depth, unsure, next }`, `reasonLine(book: Book, answers: LeafAnswers | TargetAnswers): Reason` (`@/lib/recommend`).
- Produces:
  - `QUESTION_MAP: QuestionMap` (`map.ts`)
  - `interface PathSummary { crumbs: string[]; moods: string[]; mode: "normal" | "challenge" }`, `pathSummary(map: QuestionMap, answers: Answer[]): PathSummary`
  - `pathReason(book: Book, w: Pick<Walked, "scope" | "mood">): Reason`
  - 시험용 `SQL_PATH`, `MIXED_PATH`, `CHALLENGE_PATH: Answer[]` (`__fixtures__/paths.ts`)

- [ ] **Step 1: 시험용 길과 실패하는 테스트**

```ts
// web/src/lib/paths/__fixtures__/paths.ts
import type { Answer } from "../types";

const path = (...steps: [string, Answer["choice"]][]): Answer[] => steps.map(([node, choice]) => ({ node, choice }));

/** docs/question-map.md, design 3-3 예시 길 (SQL): 11 questions, ends in the SQL keyword. */
export const SQL_PATH = path(
  ["start", "A"], ["branch", "B"], ["learn-intro", "A"], ["learn-area", "A"], ["learn-work", "A"], ["learn-tools", "A"],
  ["learn-data-field", "A"], ["learn-data-tool", "A"], ["learn-way", "B"], ["learn-way-use", "A"], ["learn-len", "A"],
);
/** 갈피를 못 잡겠어요 at the branch: both sides mixed, one mood question. */
export const MIXED_PATH = path(["start", "A"], ["branch", "unsure"], ["mix-len", "A"]);
/** 도전: SF chosen, drawn from the far side (에세이·시), the mood kept. */
export const CHALLENGE_PATH = path(
  ["start", "B"], ["branch", "A"], ["story-intro", "A"], ["story-shelf", "A"], ["story-fiction", "B"], ["story-genre", "A"],
  ["story-temp", "A"], ["story-pull", "unsure"], ["story-len", "A"],
);
```

```ts
// web/src/lib/paths/summary.test.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHALLENGE_PATH, MIXED_PATH, SQL_PATH } from "./__fixtures__/paths";
import { QUESTION_MAP } from "./map";
import { parseQuestionMap } from "./parse";
import { pathSummary } from "./summary";
import type { Answer } from "./types";
import { PathError, walkPath } from "./walk";

const MINI = parseQuestionMap(readFileSync(path.join(process.cwd(), "src/lib/paths/__fixtures__/mini-map.md"), "utf8"));
const a = (node: string, choice: Answer["choice"]): Answer => ({ node, choice });
const SQL = [a("start", "A"), a("branch", "B"), a("learn-area", "A"), a("learn-data", "A"), a("mood-way", "B"), a("mood-len", "A")];

describe("pathSummary (S-04 당신이 고른 길)", () => {
  it("lists the narrowing labels, then the mood labels, in the order they were answered", () => {
    expect(pathSummary(MINI, SQL)).toEqual({
      crumbs: ["뭔가 배우기", "데이터를 다루기", "DB에서 꺼내기"], moods: ["바로 따라 하기", "가볍게 한 권"], mode: "normal",
    });
  });

  it("keeps the challenge route and leaves out moods answered with 갈피를 못 잡겠어요", () => {
    const story = [a("start", "B"), a("branch", "A"), a("story-world", "B"), a("mood-temp", "A"), a("mood-len", "unsure")];
    expect(pathSummary(MINI, story)).toEqual({ crumbs: ["이야기에 빠지기", "딴 세상"], moods: ["따뜻한 이야기"], mode: "challenge" });
  });

  it("has no crumbs when nothing was narrowed", () => {
    expect(pathSummary(MINI, [a("start", "A"), a("branch", "unsure"), a("mood-len", "B")])).toEqual({ crumbs: [], moods: ["깊게 파고들기"], mode: "normal" });
  });

  it("works on a path that is not finished yet", () => {
    expect(pathSummary(MINI, SQL.slice(0, 2))).toEqual({ crumbs: ["뭔가 배우기"], moods: [], mode: "normal" });
  });

  it("refuses answers that are not on the map", () => {
    expect(() => pathSummary(MINI, [a("branch", "A")])).toThrow(PathError);
  });

  it("on the real map: a mood choice that only leads on (실제로 써먹는 쪽) is not a mood", () => {
    const real = [a("start", "A"), a("branch", "B"), a("learn-intro", "B"), a("learn-way", "B"), a("learn-way-use", "A"), a("learn-len", "unsure")];
    expect(pathSummary(QUESTION_MAP, real)).toEqual({ crumbs: ["뭔가 배우기"], moods: ["바로 따라 해 보기"], mode: "normal" });
  });

  it("on the real map: the three test paths end, with the summaries S-04 shows", () => {
    for (const p of [SQL_PATH, MIXED_PATH, CHALLENGE_PATH]) expect(walkPath(QUESTION_MAP, p).next).toBeNull();
    expect(pathSummary(QUESTION_MAP, SQL_PATH)).toEqual({
      crumbs: ["뭔가 배우기", "일을 더 잘하기", "숫자·도구 다루기", "데이터 읽고 분석", "데이터 꺼내는 도구", "DB에서 꺼내기"],
      moods: ["바로 따라 해 보기", "가볍게 한 권"], mode: "normal",
    });
    expect(pathSummary(QUESTION_MAP, MIXED_PATH)).toEqual({ crumbs: [], moods: ["가볍게 얇은 책"], mode: "normal" });
    expect(pathSummary(QUESTION_MAP, CHALLENGE_PATH)).toEqual({
      crumbs: ["이야기에 빠지기", "소설 속으로", "장르의 짜릿함", "여기 없는 딴 세상"],
      moods: ["몽글몽글 따뜻함", "쏙 들어가는 얇은 책"], mode: "challenge",
    });
  });
});
```

```ts
// web/src/lib/paths/reason.test.ts
import { describe, expect, it } from "vitest";
import type { LeafBook, TargetBook } from "@/lib/recommend";
import { pathReason } from "./reason";
import { ALL_SCOPE, NEUTRAL_MOOD } from "./types";

const t = (topic: string, keywords: string[], way: TargetBook["way"], pages: number): TargetBook =>
  ({ id: "T", entry: "target", field: "데이터·통계", topic, genre: topic, pages, way, keywords });
const leaf: LeafBook = { id: "L", entry: "leaf", genre: "에세이", pages: 300, axes: { temp: 1, pull: 0, gain: 0, world: 0 } };

describe("pathReason (S-06 / 책갈피 뒷면 나온 이유, from the path)", () => {
  it("🍃: the mood axes the book shares", () => {
    const w = { scope: { ...ALL_SCOPE, entry: "leaf" as const }, mood: { ...NEUTRAL_MOOD, axes: { temp: 1, pull: 0, gain: 0, world: 0 } } };
    expect(pathReason(leaf, w)).toEqual({ label: "나온 이유", items: ["따뜻함"] });
  });

  it("🎯 in the narrowed scope: topic, the keyword it matched, way and length", () => {
    const w = { scope: { ...ALL_SCOPE, entry: "target" as const, topics: ["데이터 분석"], keywords: ["SQL"] }, mood: { ...NEUTRAL_MOOD, way: "실습" as const, len: 1 as const } };
    expect(pathReason(t("데이터 분석", ["SQL"], "실습", 200), w)).toEqual({ label: "나온 이유", items: ["데이터 분석", "SQL", "따라 하며 실습", "얇게"] });
  });

  it("🎯 from above the scope (the 운명 1장 or a widened draw): what the book is", () => {
    const w = { scope: { ...ALL_SCOPE, entry: "target" as const, topics: ["데이터 분석"] }, mood: NEUTRAL_MOOD };
    expect(pathReason(t("통계", ["회귀분석"], "개념", 300), w)).toEqual({ label: "이 책은", items: ["통계", "개념부터 쉽게"] });
  });

  it("🎯 when no topic was chosen: the book's own topic counts as asked", () => {
    const w = { scope: { ...ALL_SCOPE, entry: "target" as const }, mood: NEUTRAL_MOOD };
    expect(pathReason(t("데이터 분석", ["SQL"], "사례", 300), w)).toEqual({ label: "나온 이유", items: ["데이터 분석"] });
  });
});
```

`web/src/lib/paths/data.test.ts`의 `describe` 안 맨 끝에 추가하고, import 줄에 `import { QUESTION_MAP } from "./map";`을 더한다:
```ts
  it("is what the app reads (QUESTION_MAP)", () => {
    expect(QUESTION_MAP).toBe(built);
    expect(QUESTION_MAP.start).toBe("start");
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/paths`
Expected: FAIL — `./map`, `./summary`, `./reason`을 찾지 못함.

- [ ] **Step 3: 구현**

```ts
// web/src/lib/paths/map.ts
import built from "@/data/question-map.json";
import type { QuestionMap } from "./types";

/** docs/question-map.md as built by `npm run map:build` — the one map the app and the server walk. */
export const QUESTION_MAP = built as QuestionMap;
```

```ts
// web/src/lib/paths/summary.ts
import type { Answer, Effects, QuestionMap } from "./types";
import { walkPath } from "./walk";

/** S-04 "당신이 고른 길" (design 10절): the narrowing labels in order, the mood labels in order, the route. */
export interface PathSummary { crumbs: string[]; moods: string[]; mode: "normal" | "challenge" }

const setsMood = (e: Effects) => e.axes !== undefined || e.len !== undefined || e.way !== undefined;

/** Narrowing crumbs come from walkPath; a mood answer counts only when it sets a mood (a choice that only leads on does not). */
export function pathSummary(map: QuestionMap, answers: Answer[]): PathSummary {
  const w = walkPath(map, answers);
  const moods = answers.flatMap(({ node, choice }) => {
    const n = map.nodes[node];
    if (n.kind !== "mood" || choice === "unsure") return [];
    const c = choice === "A" ? n.a : n.b;
    return setsMood(c.effects) ? [c.label] : [];
  });
  return { crumbs: w.crumbs, moods, mode: w.mode };
}
```

```ts
// web/src/lib/paths/reason.ts
import { reasonLine, type Book, type Reason } from "@/lib/recommend";
import type { Walked } from "./walk";

/**
 * "나온 이유" for a book drawn on a path — the same reasonLine as v1, fed from the path: 🍃 by the mood axes and length,
 * 🎯 by the scope's topic (the book's own when no topic or the book is in it) and keywords, the mood's way and length.
 * Pass the walk after applyChallenge, so a challenge book is explained by the far scope it came from.
 */
export function pathReason(book: Book, w: Pick<Walked, "scope" | "mood">): Reason {
  if (book.entry === "leaf") return reasonLine(book, { ...w.mood.axes, len: w.mood.len });
  const topics = w.scope.topics;
  const topic = topics === null || topics.includes(book.topic) ? book.topic : topics[0];
  return reasonLine(book, { topic, way: w.mood.way, len: w.mood.len, keywords: w.scope.keywords ?? [] });
}
```

`web/src/lib/paths/index.ts` 끝에 세 줄:
```ts
export { QUESTION_MAP } from "./map";
export { pathSummary, type PathSummary } from "./summary";
export { pathReason } from "./reason";
```

- [ ] **Step 4: 통과와 100% 확인**

Run: `npx vitest run src/lib/paths && npx vitest run --coverage src/lib/paths src/lib/recommend`
Expected: PASS, `src/lib/paths/**` lines/branches/functions/statements 100% (임계 실패 없음).

- [ ] **Step 5: 커밋**

```bash
git add web/src/lib/paths
git commit -m "feat(paths): question map constant, S-04 path summary and path-based reasons

- [x] events: no event change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 서버 뽑기 — 답 목록으로 (옛 모양과 함께)

**Files:**
- Modify: `web/src/lib/books/types.ts`, `web/src/lib/books/draw.ts`, `web/src/lib/books/request.ts`, `web/src/app/api/books/draw/route.ts`
- Test: `web/src/lib/books/draw.test.ts`, `web/src/lib/books/request.test.ts`, `web/src/app/api/books/draw/route.test.ts`

**Interfaces:**
- Consumes: `QUESTION_MAP`, `walkPath`, `PathError`, `applyChallenge`, `drawForPath(books, map, walked, { seen, rng }): PathDraw`, `pathSummary`, `pathReason` (Task 3); `toBook`, `toCard` (`lib/books/catalog`).
- Produces:
  - `interface PathDrawResponse { picks: CardPick[]; exhausted: boolean; widened: boolean; path: PathSummary }` (`lib/books/types.ts`)
  - `drawPath(answers: Answer[], seen: ReadonlySet<string>, rng: Rng, books: CatalogBook[], map?: QuestionMap): PathDrawResponse`
  - `parseDrawRequest(body: unknown, vocab: Vocab, map?: QuestionMap): DrawRequest | null` — `DrawQuery`에 `{ entry: "path"; answers: Answer[] }` 추가. 본문에 `entry`가 없으면 길 요청: `{ answers: Answer[]; seen?: string[]; seed?: number }`.
  - `MAX_ANSWERS = 40`
  - POST `/api/books/draw` 길 요청 → `PathDrawResponse`. 카드(`card`·`kind`·`reason`) 모양은 그대로.

먼저 읽기: `web/node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, `…/03-api-reference/03-file-conventions/route.md`.

- [ ] **Step 1: 실패하는 테스트**

`web/src/lib/books/draw.test.ts` 끝에 추가(import에 `drawPath` 추가, 새 import 두 줄):
```ts
import { CHALLENGE_PATH, MIXED_PATH, SQL_PATH } from "@/lib/paths/__fixtures__/paths";

describe("drawPath (v2: the answers of the question map)", () => {
  const sql = BOOKS.filter((b) => b.keywords.includes("SQL")).map((b) => b.isbn);

  it("SQL path: five different books, one 운명, the SQL books first, and the path for S-04", () => {
    const res = drawPath(SQL_PATH, none, mulberry32(7), BOOKS);
    expect(res.picks).toHaveLength(5);
    expect(new Set(res.picks.map((p) => p.card.id)).size).toBe(5);
    expect(res.picks.filter((p) => p.kind === "random")).toHaveLength(1);
    expect(res.picks.every((p) => p.card.entry === "target")).toBe(true);           // widened inside 🎯 only
    expect(res.picks.filter((p) => sql.includes(p.card.id))).toHaveLength(2);       // both SQL books of the sample
    expect(res.widened).toBe(true);                                                   // 2 SQL books < 4: the level above filled it
    expect(res.path).toEqual({
      crumbs: ["뭔가 배우기", "일을 더 잘하기", "숫자·도구 다루기", "데이터 읽고 분석", "데이터 꺼내는 도구", "DB에서 꺼내기"],
      moods: ["바로 따라 해 보기", "가볍게 한 권"], mode: "normal",
    });
    const sqlPick = res.picks.find((p) => sql.includes(p.card.id) && p.kind === "recommended");
    expect(sqlPick?.reason).toMatchObject({ label: "나온 이유", items: expect.arrayContaining(["데이터 분석", "SQL"]) });
    expect(Object.keys(res.picks[0]).sort()).toEqual(["card", "kind", "reason"]);
  });

  it("challenge path: 🍃 books from the far side, the route kept for S-04", () => {
    const res = drawPath(CHALLENGE_PATH, none, mulberry32(3), BOOKS);
    expect(res.picks).toHaveLength(5);
    expect(res.picks.every((p) => p.card.entry === "leaf")).toBe(true);
    expect(res.path.mode).toBe("challenge");
  });

  it("mixed path: any book of the library, never one already shown", () => {
    const seen = new Set(BOOKS.slice(0, 10).map((b) => b.isbn));
    const res = drawPath(MIXED_PATH, seen, mulberry32(5), BOOKS);
    expect(res.picks).toHaveLength(5);
    expect(res.picks.some((p) => seen.has(p.card.id))).toBe(false);
    expect(res.path).toEqual({ crumbs: [], moods: ["가볍게 얇은 책"], mode: "normal" });
  });
});
```

`web/src/lib/books/request.test.ts` 끝에 추가(import에 `MAX_ANSWERS` 추가):
```ts
import { SQL_PATH } from "@/lib/paths/__fixtures__/paths";

describe("parseDrawRequest — v2 path body (no entry)", () => {
  const V = vocab as Vocab;
  it("accepts a finished path with seen and seed", () => {
    expect(parseDrawRequest({ answers: SQL_PATH, seen: ["x"], seed: 3 }, V))
      .toEqual({ query: { entry: "path", answers: SQL_PATH }, seen: ["x"], seed: 3 });
  });
  it("keeps only node and choice of each answer it accepts", () => {
    const parsed = parseDrawRequest({ answers: SQL_PATH.map((a) => ({ ...a })) }, V);
    expect(parsed?.query).toEqual({ entry: "path", answers: SQL_PATH });
  });
  it.each([
    ["answers missing", {}],
    ["answers not a list", { answers: "start" }],
    ["no answers", { answers: [] }],
    ["an unfinished path", { answers: SQL_PATH.slice(0, -1) }],
    ["a question that was not asked", { answers: [{ node: "branch", choice: "A" }] }],
    ["an unknown choice", { answers: [{ node: "start", choice: "C" }, ...SQL_PATH.slice(1)] }],
    ["an extra key on an answer", { answers: [{ node: "start", choice: "A", text: "hi" }, ...SQL_PATH.slice(1)] }],
    ["a node id that is not a string", { answers: [{ node: 1, choice: "A" }] }],
    ["a node id over 64 characters", { answers: [{ node: "x".repeat(65), choice: "A" }] }],
    ["too many answers", { answers: Array.from({ length: MAX_ANSWERS + 1 }, () => ({ node: "start", choice: "A" })) }],
    ["an answer that is not an object", { answers: [null] }],
  ])("refuses %s", (_, body) => {
    expect(parseDrawRequest(body, V)).toBeNull();
  });
});
```
(`request.test.ts`가 이미 `vocab`·`Vocab`을 import하지 않으면 `import vocab from "@/data/vocab.json";`과 `import type { Vocab } from "./types";`를 더한다.)

`web/src/app/api/books/draw/route.test.ts`의 `describe` 안 끝에 추가(import `SQL_PATH`):
```ts
  it("draws five bookmarks for a v2 path and returns the path S-04 shows", async () => {
    const res = await POST(req({ answers: SQL_PATH, seen: [], seed: 7 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.picks).toHaveLength(5);
    expect(Object.keys(body).sort()).toEqual(["exhausted", "path", "picks", "widened"]);
    expect(body.path.crumbs.at(-1)).toBe("DB에서 꺼내기");
    expect(Object.keys(body.picks[0].card).sort()).toEqual(["author", "entry", "field", "genre", "id", "oneLiner", "oneLinerStyle", "title"]);
  });

  it("refuses an unfinished path with 400", async () => {
    expect((await POST(req({ answers: SQL_PATH.slice(0, 3) }))).status).toBe(400);
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/books src/app/api/books/draw`
Expected: FAIL — `drawPath`·`MAX_ANSWERS` 없음, 길 본문이 400.

- [ ] **Step 3: 구현**

`web/src/lib/books/types.ts` — 맨 위 import에 `import type { PathSummary } from "../paths/summary";`를 더하고 `DrawResponse` 아래에 넣는다:
```ts
/** POST /api/books/draw for a v2 path: the same cards, plus what S-04 "당신이 고른 길" shows. */
export interface PathDrawResponse {
  picks: CardPick[];
  exhausted: boolean;
  widened: boolean;
  path: PathSummary;
}
```

`web/src/lib/books/draw.ts` — import를 늘리고 함수를 더한다:
```ts
import { applyChallenge, drawForPath, pathReason, pathSummary, QUESTION_MAP, walkPath, type Answer, type QuestionMap } from "@/lib/paths";
import type { CatalogBook, DrawResponse, PathDrawResponse } from "./types";

/**
 * v2: answers of the question map → five bookmarks (lib/paths drawForPath). The answers must be a finished path —
 * parseDrawRequest checks that before this runs. Reasons come from the scope the books were drawn from (after the
 * challenge flip) and the person's mood.
 */
export function drawPath(answers: Answer[], seen: ReadonlySet<string>, rng: Rng, books: CatalogBook[], map: QuestionMap = QUESTION_MAP): PathDrawResponse {
  const walked = walkPath(map, answers);
  const res = drawForPath(books.map(toBook), map, walked, { seen, rng });
  const drawnFrom = applyChallenge(map, walked);
  const byId = new Map(books.map((b) => [b.isbn, b]));
  return {
    picks: res.picks.map((p) => ({ card: toCard(byId.get(p.book.id) as CatalogBook), kind: p.kind, reason: pathReason(p.book, drawnFrom) })),
    exhausted: res.exhausted,
    widened: res.widened || res.widenedScope,
    path: pathSummary(map, answers),
  };
}
```
(기존 `import type { CatalogBook, DrawResponse } from "./types";` 줄은 위 줄로 바꾼다.)

`web/src/lib/books/request.ts`:
```ts
import { PathError, QUESTION_MAP, walkPath, type Answer, type QuestionMap } from "@/lib/paths";

export type DrawQuery =
  | { entry: "leaf"; choices: BalanceChoice[] }
  | { entry: "target"; answers: TargetAnswers }
  | { entry: "path"; answers: Answer[] };

/** v2: the most answers one path can take is 11 today; 40 leaves room for a longer map, and caps the body. */
export const MAX_ANSWERS = 40;
const MAX_NODE = 64;

/** A finished path of the map, each answer exactly { node, choice } — anything else is null. */
function parseAnswers(x: unknown, map: QuestionMap): Answer[] | null {
  if (!Array.isArray(x) || x.length === 0 || x.length > MAX_ANSWERS) return null;
  const ok = x.every((a) => isObject(a) && Object.keys(a).length === 2 && typeof a.node === "string"
    && a.node.length <= MAX_NODE && CHOICES.has(a.choice));
  if (!ok) return null;
  const answers = (x as Answer[]).map(({ node, choice }) => ({ node, choice }));
  try {
    return walkPath(map, answers).next === null ? answers : null;
  } catch (e) {
    if (e instanceof PathError) return null;
    throw e;
  }
}
```
`parseDrawRequest` 시그니처와 본문 — seen/seed 검사 바로 뒤, `if (body.entry === "leaf")` **앞**에 넣는다:
```ts
export function parseDrawRequest(body: unknown, vocab: Vocab, map: QuestionMap = QUESTION_MAP): DrawRequest | null {
  if (!isObject(body)) return null;
  const seen = parseSeen(body.seen);
  const seed = parseSeed(body.seed);
  if (!seen || seed === undefined) return null;
  if (body.entry === undefined) {
    const answers = parseAnswers(body.answers, map);
    return answers ? { query: { entry: "path", answers }, seen, seed } : null;
  }
  // … the leaf and target branches stay as they are until Task 7
```
(`throw e` 줄은 PathError 말고는 던지지 않는 `walkPath` 앞에서 닿지 않는다 — `lib/books`는 100% 임계 밖이다.)

`web/src/app/api/books/draw/route.ts`의 import와 뽑기 줄:
```ts
import { drawLeaf, drawPath, drawTarget } from "@/lib/books/draw";
…
  const result = parsed.query.entry === "path"
    ? drawPath(parsed.query.answers, seen, rng, books)
    : parsed.query.entry === "leaf"
      ? drawLeaf(parsed.query.choices, seen, rng, books)
      : drawTarget(parsed.query.answers, seen, rng, books);
```
옛 `respond()`와 `DrawResponse`는 Task 7까지 그대로 둔다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/books src/app/api/books/draw && npm run typecheck`
Expected: PASS, tsc 오류 없음.

- [ ] **Step 5: 커밋**

```bash
git add web/src/lib/books web/src/app/api/books/draw
git commit -m "feat(draw): server draws five bookmarks from a question-map path

- [x] events: no event change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 화면 조각 — 지도 도우미·질문 화면·고른 길 쪽

**Files:**
- Create: `web/src/lib/flow/path.ts`, `web/src/components/flow/Question.tsx`, `web/src/components/flow/Question.module.css`, `web/src/components/flow/PathPage.tsx`
- Modify: `web/src/components/flow/FirstPage.module.css`
- Test: `web/src/lib/flow/path.test.ts`, `web/src/components/flow/Question.test.tsx`, `web/src/components/flow/PathPage.test.tsx`

**Interfaces:**
- Consumes: `QUESTION_MAP`, `walkPath`, `applyChallenge`, `scopeKey`, `PathError`, `PathSummary`, `Answer`, `AnswerChoice`, `QNode` (`@/lib/paths`); `HoldButton({ label, hint, onHold, onCancel })`; `BookmarkFrame.module.css` (`frame`, `string`, `film`, `hole`, `stitch`).
- Produces:
  - `nextQuestion(answers: readonly Answer[], map?: QuestionMap): QNode | null`
  - `isPath(x: unknown, map?: QuestionMap): x is Answer[]`
  - `sameAnswers(a: readonly Answer[], b: readonly Answer[]): boolean`
  - `pathCommon(answers: readonly Answer[], map?: QuestionMap): { entry: Entry | null; mode: "normal" | "challenge" | null }`
  - `completedProps(answers: readonly Answer[], map?: QuestionMap): { scope_id: string; depth: number; unsure_count: number }`
  - `<Question node onAnswer(choice: AnswerChoice, elapsedMs: number) onHoldCancel(heldMs: number) onBack() />` + `TAP_GUARD_MS = 250`, `HOLD_HINT`, `UNSURE = "갈피를 못 잡겠어요"`, `BACK = "이전 질문"`
  - `<PathPage summary: PathSummary | null notices: readonly string[] />` + `CHALLENGE_LINE`, `WHOLE_LIBRARY`, `MOOD_ANY`
  - 표시만 한다 — `track()`을 부르지 않는다(이벤트는 Task 6의 `Flow`가 보냄).

- [ ] **Step 1: 실패하는 테스트**

```ts
// web/src/lib/flow/path.test.ts
import { describe, expect, it } from "vitest";
import { CHALLENGE_PATH, MIXED_PATH, SQL_PATH } from "@/lib/paths/__fixtures__/paths";
import { completedProps, isPath, nextQuestion, pathCommon, sameAnswers } from "./path";

describe("flow path helpers (the real question map)", () => {
  it("asks the start question first and nothing after a finished path", () => {
    expect(nextQuestion([])?.id).toBe("start");
    expect(nextQuestion(SQL_PATH.slice(0, 2))?.id).toBe("learn-intro");
    expect(nextQuestion(SQL_PATH)).toBeNull();
  });

  it("checks a saved answer list against the map", () => {
    expect(isPath([])).toBe(true);
    expect(isPath(SQL_PATH.slice(0, 4))).toBe(true);
    expect(isPath(SQL_PATH)).toBe(true);
    expect(isPath("start")).toBe(false);
    expect(isPath([{ node: "branch", choice: "A" }])).toBe(false);
    expect(isPath([{ node: "start", choice: "C" }])).toBe(false);
    expect(isPath([null])).toBe(false);
  });

  it("compares two answer lists by node and choice", () => {
    expect(sameAnswers(SQL_PATH, SQL_PATH.map((a) => ({ ...a })))).toBe(true);
    expect(sameAnswers(SQL_PATH, SQL_PATH.slice(0, -1))).toBe(false);
    expect(sameAnswers(SQL_PATH, [...SQL_PATH.slice(0, -1), { node: "learn-len", choice: "B" }])).toBe(false);
  });

  it("gives the common branch and route: none before the first answer, the branch once chosen (taxonomy v1.0 3-1)", () => {
    expect(pathCommon([])).toEqual({ entry: null, mode: null });
    expect(pathCommon(SQL_PATH.slice(0, 1))).toEqual({ entry: null, mode: "normal" });
    expect(pathCommon(SQL_PATH)).toEqual({ entry: "target", mode: "normal" });
    expect(pathCommon(MIXED_PATH)).toEqual({ entry: null, mode: "normal" });
    expect(pathCommon(CHALLENGE_PATH)).toEqual({ entry: "leaf", mode: "challenge" });   // the branch chosen, not the far side
  });

  it("builds E-34 path_completed: the drawn scope as map:coverage keys it, the questions and the unsure answers", () => {
    expect(completedProps(SQL_PATH)).toEqual({ scope_id: "entry=target;topics=데이터 분석;keywords=SQL", depth: 11, unsure_count: 0 });
    expect(completedProps(MIXED_PATH)).toEqual({ scope_id: "all", depth: 3, unsure_count: 1 });
    expect(completedProps(CHALLENGE_PATH)).toEqual({ scope_id: "entry=leaf;genres=시,에세이", depth: 9, unsure_count: 1 });
  });
});
```

```tsx
// web/src/components/flow/Question.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QUESTION_MAP } from "@/lib/paths";
import { HOLD_HINT, Question, TAP_GUARD_MS } from "./Question";

const START = QUESTION_MAP.nodes.start;     // 평소 끌리는 쪽으로 / 오늘은 낯선 쪽으로 도전
const settle = () => act(() => { vi.advanceTimersByTime(TAP_GUARD_MS); });
const handlers = () => ({ onAnswer: vi.fn(), onHoldCancel: vi.fn(), onBack: vi.fn() });

describe("Question (S-02)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("asks the question with A on the left and B on the right, each a bookmark card with no picture", () => {
    const { container } = render(<Question node={START} {...handlers()} />);
    expect(screen.getByRole("heading", { level: 1, name: START.question })).toBeInTheDocument();
    expect(container.querySelector('[data-side="left"]')).toHaveTextContent(START.a.label);
    expect(container.querySelector('[data-side="right"]')).toHaveTextContent(START.b.label);
    expect(container.querySelector("svg, image, img")).toBeNull();
  });

  it("shows no path and no count while answering (design 10절)", () => {
    const { container } = render(<Question node={QUESTION_MAP.nodes["learn-data-tool"]} {...handlers()} />);
    expect(container).not.toHaveTextContent(/\d+\s*\/\s*\d+/);
    expect(container).not.toHaveTextContent("›");
    expect(container.querySelector("ol, progress")).toBeNull();
  });

  it("answers A or B with the time it took, once the tap guard has passed", () => {
    const h = handlers();
    render(<Question node={START} {...h} />);
    fireEvent.click(screen.getByRole("button", { name: START.a.label }));          // a double tap's tail: ignored
    expect(h.onAnswer).not.toHaveBeenCalled();
    settle();
    fireEvent.click(screen.getByRole("button", { name: START.b.label }));
    expect(h.onAnswer).toHaveBeenCalledWith("B", TAP_GUARD_MS);
  });

  it("answers 갈피를 못 잡겠어요 after the hold, and reports a hold let go too early", () => {
    const h = handlers();
    render(<Question node={START} {...h} />);
    const hold = screen.getByRole("button", { name: "갈피를 못 잡겠어요" });
    fireEvent.pointerDown(hold);
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.pointerUp(hold);
    expect(h.onHoldCancel).toHaveBeenCalledWith(expect.any(Number));
    fireEvent.pointerDown(hold);
    expect(screen.getByRole("status")).toHaveTextContent(HOLD_HINT);
    act(() => { vi.advanceTimersByTime(800); });
    expect(h.onAnswer).toHaveBeenCalledWith("unsure", expect.any(Number));
  });

  it("offers [← 이전 질문] on every question, 44px tall by its class", () => {
    const h = handlers();
    render(<Question node={START} {...h} />);
    const back = screen.getByRole("button", { name: "이전 질문" });
    expect(back).toHaveTextContent("← 이전 질문");
    fireEvent.click(back);
    expect(h.onBack).toHaveBeenCalledTimes(1);
  });
});
```

```tsx
// web/src/components/flow/PathPage.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CHALLENGE_LINE, MOOD_ANY, PathPage, WHOLE_LIBRARY } from "./PathPage";

describe("PathPage (S-04 당신이 고른 길)", () => {
  it("lists the path, then the mood, with no book count", () => {
    const { container } = render(<PathPage summary={{ crumbs: ["뭔가 배우기", "DB에서 꺼내기"], moods: ["바로 따라 해 보기"], mode: "normal" }} notices={[]} />);
    const way = screen.getByRole("region", { name: "지나온 길" });
    expect([...way.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["뭔가 배우기", "DB에서 꺼내기"]);
    expect(screen.getByRole("region", { name: "기분" })).toHaveTextContent("바로 따라 해 보기");
    expect(container).not.toHaveTextContent(/권/);
    expect(screen.queryByText(CHALLENGE_LINE)).toBeNull();
  });

  it("says so on the challenge route", () => {
    render(<PathPage summary={{ crumbs: ["여기 없는 딴 세상"], moods: [], mode: "challenge" }} notices={[]} />);
    expect(screen.getByText("평소의 당신과 반대편에서 골랐어요")).toBeInTheDocument();
  });

  it("names the whole library and a mood left to Galpi when nothing was narrowed or chosen", () => {
    render(<PathPage summary={{ crumbs: [], moods: [], mode: "normal" }} notices={[]} />);
    expect(screen.getByText(WHOLE_LIBRARY)).toBeInTheDocument();
    expect(screen.getByText(MOOD_ANY)).toBeInTheDocument();
  });

  it("shows only the notes while the draw is on its way", () => {
    render(<PathPage summary={null} notices={["조건에 딱 맞는 책은 여기까지예요"]} />);
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("조건에 딱 맞는 책은 여기까지예요");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/flow/path.test.ts src/components/flow/Question.test.tsx src/components/flow/PathPage.test.tsx`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

```ts
// web/src/lib/flow/path.ts
import { applyChallenge, QUESTION_MAP, scopeKey, walkPath, type Answer, type QNode, type QuestionMap } from "@/lib/paths";
import type { Entry } from "@/lib/recommend";

/** The question to ask after these answers, or null once the path is finished. Throws PathError off the map. */
export function nextQuestion(answers: readonly Answer[], map: QuestionMap = QUESTION_MAP): QNode | null {
  const next = walkPath(map, [...answers]).next;
  return next === null ? null : map.nodes[next];
}

const isAnswer = (a: unknown): a is Answer =>
  typeof a === "object" && a !== null && typeof (a as Answer).node === "string"
  && ["A", "B", "unsure"].includes((a as Answer).choice);

/** A saved answer list that still walks this map (the map may have changed since it was saved). */
export function isPath(x: unknown, map: QuestionMap = QUESTION_MAP): x is Answer[] {
  if (!Array.isArray(x) || !x.every(isAnswer)) return false;
  try {
    walkPath(map, x);
    return true;
  } catch {
    return false;
  }
}

export const sameAnswers = (a: readonly Answer[], b: readonly Answer[]): boolean =>
  a.length === b.length && a.every((x, i) => x.node === b[i].node && x.choice === b[i].choice);

/** taxonomy v1.0 3-1: common `entry` = the branch chosen (leaf 이야기 / target 배우기), `mode` = the route — none before the first answer. */
export function pathCommon(answers: readonly Answer[], map: QuestionMap = QUESTION_MAP): { entry: Entry | null; mode: "normal" | "challenge" | null } {
  const w = walkPath(map, [...answers]);
  return { entry: w.scope.entry, mode: answers.length === 0 ? null : w.mode };
}

/** E-34 path_completed: the scope the books are drawn from (after the challenge flip — `npm run map:coverage`'s key). */
export function completedProps(answers: readonly Answer[], map: QuestionMap = QUESTION_MAP): { scope_id: string; depth: number; unsure_count: number } {
  const w = walkPath(map, [...answers]);
  return { scope_id: scopeKey(applyChallenge(map, w).scope), depth: w.depth, unsure_count: w.unsure };
}
```

```tsx
// web/src/components/flow/Question.tsx
"use client";
import { useEffect, useRef } from "react";
import type { AnswerChoice, QNode } from "@/lib/paths";
import frame from "@/components/BookmarkFrame.module.css";
import { HoldButton } from "./HoldButton";
import styles from "./Question.module.css";

/** A card tap this soon after a question appears is the tail of a double tap on the previous one, not an answer. */
export const TAP_GUARD_MS = 250;
/** PRD F-03 · DESIGN C-08: shown in the hold button while it is pressed. */
export const HOLD_HINT = "끌리는 쪽을 고를수록 더 잘 맞아요";
export const UNSURE = "갈피를 못 잡겠어요";
export const BACK = "이전 질문";

interface Props {
  node: QNode;
  onAnswer: (choice: AnswerChoice, elapsedMs: number) => void;
  onHoldCancel: (heldMs: number) => void;
  onBack: () => void;
}

/** C-07: the bookmark shape with the choice in the arched window instead of a picture. The whole card is the button. */
function ChoiceCard({ side, label, onChoose }: { side: "left" | "right"; label: string; onChoose: () => void }) {
  return (
    <button type="button" className={`${frame.frame} ${styles.card}`} data-side={side} onClick={onChoose}>
      <span className={frame.string} aria-hidden="true" />
      <span className={`${frame.film} ${styles.film}`}>
        <span className={frame.hole} aria-hidden="true" />
        <span className={styles.window}>{label}</span>
        <span className={frame.stitch} aria-hidden="true" />
      </span>
    </button>
  );
}

/**
 * S-02 (design 10절): one two-way question of the map — the balance-game cards, the hold button, [← 이전 질문] (C-23).
 * No path and no count while answering: S-04 shows them. Shows only; Flow sends the events. Flow remounts it per
 * question (key), so the tap guard and the hold start again.
 */
export function Question({ node, onAnswer, onHoldCancel, onBack }: Props) {
  const shownAt = useRef(0);
  useEffect(() => { shownAt.current = performance.now(); }, []);
  const elapsed = () => Math.round(performance.now() - shownAt.current);
  const choose = (choice: "A" | "B") => {
    const ms = elapsed();
    if (ms < TAP_GUARD_MS) return;
    onAnswer(choice, ms);
  };
  return (
    <section className={styles.game} aria-labelledby="question-text">
      <button type="button" className={styles.back} onClick={onBack}>
        <span aria-hidden="true">←</span> {BACK}
      </button>
      <h1 id="question-text" className={styles.question}>{node.question}</h1>
      <div className={styles.pair}>
        <ChoiceCard side="left" label={node.a.label} onChoose={() => choose("A")} />
        <span className={styles.vs} aria-hidden="true">vs</span>
        <ChoiceCard side="right" label={node.b.label} onChoose={() => choose("B")} />
      </div>
      <HoldButton label={UNSURE} hint={HOLD_HINT} onHold={() => onAnswer("unsure", elapsed())} onCancel={onHoldCancel} />
    </section>
  );
}
```

```css
/* web/src/components/flow/Question.module.css — S-02 (C-07 cards, C-08 hold, C-23 back). No progress bar (10-04). */
.game { display: flex; flex-direction: column; gap: var(--space-4); padding-top: var(--space-2); }
/* C-23: a quiet text button, left, 44px tall — never the screen's primary button. */
.back {
  align-self: flex-start; display: inline-flex; align-items: center; gap: 6px;
  min-height: 44px; padding: 0 var(--space-2) 0 0; border: 0; background: none;
  color: var(--ink-muted); font: inherit; font-size: 14px; cursor: pointer;
}
.back:focus-visible { outline: 3px solid var(--field-data); outline-offset: 2px; }
.question { margin: 0 0 var(--space-3); font-size: 20px; line-height: 1.5; text-align: center; word-break: keep-all; }
/* C-07 (09-30): two bookmark-shaped cards, "vs" in a small seal between — about 150–160px each, so they fit a 375px phone. */
.pair {
  display: grid; grid-template-columns: minmax(0, 160px) auto minmax(0, 160px);
  justify-content: center; align-items: stretch; gap: 6px;
}
.card {
  --tone: var(--cloth);
  display: flex; flex-direction: column; width: 100%; margin: 0; padding: 26px 0 0;
  border: 0; background: none; color: var(--ink); font: inherit; text-align: center; cursor: pointer;
}
.card:focus-visible { outline: 3px solid var(--field-data); outline-offset: 2px; }
.film { flex: 1; gap: 10px; padding: 16px 9px 22px; }
/* The arched window (arch radius = half its width) holds the choice instead of a picture. P-02 note: keep-all breaks. */
.window {
  display: flex; align-items: center; justify-content: center;
  width: 100%; aspect-ratio: 1 / 1.1; padding: 22% 10px 10px;
  border-radius: 50% 50% 6px 6px / 45.5% 45.5% 6px 6px;
  background: var(--paper-deep);
  font-family: var(--font-batang), serif; font-size: 16px; font-weight: 700; line-height: 1.45; word-break: keep-all;
}
.card:active .window { background: var(--paper-line); }
.vs {
  align-self: center; display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 50%; background: var(--paper-deep);
  font-family: var(--font-batang), serif; font-size: 13px; color: var(--ink-muted);
}
```

```tsx
// web/src/components/flow/PathPage.tsx
import type { PathSummary } from "@/lib/paths";
import styles from "./FirstPage.module.css";

export const CHALLENGE_LINE = "평소의 당신과 반대편에서 골랐어요";
export const WHOLE_LIBRARY = "책장 전체에서";
export const MOOD_ANY = "기분은 갈피에게 맡겼어요";

/**
 * S-04 right page (DESIGN C-10 v2, design 10절): "당신이 고른 길" — the narrowing answers in order, then the mood
 * answers. No book count: a short scope is widened quietly. The challenge route gets one line on top. `summary` is the
 * draw's `path`; null while the draw is on its way (only the notes show).
 */
export function PathPage({ summary, notices }: { summary: PathSummary | null; notices: readonly string[] }) {
  return (
    <div className={styles.page}>
      {summary && (
        <>
          {summary.mode === "challenge" && <p className={styles.challenge}>{CHALLENGE_LINE}</p>}
          <section aria-labelledby="path-way">
            <h3 id="path-way" className={styles.label}>지나온 길</h3>
            <ol className={styles.rows}>
              {(summary.crumbs.length ? summary.crumbs : [WHOLE_LIBRARY]).map((c, i) => <li key={`${i}-${c}`} className={styles.row}>{c}</li>)}
            </ol>
          </section>
          <section aria-labelledby="path-mood">
            <h3 id="path-mood" className={styles.label}>기분</h3>
            <ul className={styles.rows}>
              {(summary.moods.length ? summary.moods : [MOOD_ANY]).map((m, i) => <li key={`${i}-${m}`} className={styles.row}>{m}</li>)}
            </ul>
          </section>
        </>
      )}
      {notices.map((n) => <p key={n} className={styles.note} role="status">{n}</p>)}
    </div>
  );
}
```

`web/src/components/flow/FirstPage.module.css`의 `.dots` 줄 아래에 넣는다:
```css
/* C-10 v2: small section names and the challenge line */
.label { margin: 0 0 var(--space-1); font-size: 12px; font-weight: 400; color: var(--ink-muted); }
.challenge { margin: 0; font-family: var(--font-batang), serif; font-size: 14px; line-height: 1.5; word-break: keep-all; color: var(--cloth); }
```
그리고 `@media (min-width: 768px)` 블록 안 `.note { font-size: 14px; }` 아래에 `.label { font-size: 14px; }`.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/flow/path.test.ts src/components/flow/Question.test.tsx src/components/flow/PathPage.test.tsx && npm run typecheck && npm run lint`
Expected: PASS, 오류 없음. (`<section aria-labelledby>`는 이름이 있어 role region으로 잡힌다.)

- [ ] **Step 5: 커밋**

```bash
git add web/src/lib/flow/path.ts web/src/lib/flow/path.test.ts web/src/components/flow/Question.tsx web/src/components/flow/Question.module.css web/src/components/flow/Question.test.tsx web/src/components/flow/PathPage.tsx web/src/components/flow/PathPage.test.tsx web/src/components/flow/FirstPage.module.css
git commit -m "feat(flow): question screen, path page and map helpers (not wired yet)

- [x] events: no event change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: taxonomy v1.0 + 흐름 연결 (한 커밋)

이벤트 원칙 3-1 때문에 문서·csv·`schema.ts`·테스트·`track()`·화면이 한 커밋이다. 단계는 나누되 커밋은 Step 14 한 번.

**Files:**
- Modify: `docs/taxonomy.md`, `docs/taxonomy.csv`, `web/src/lib/track/schema.ts`, `web/src/lib/track/common.ts`, `web/src/lib/track/amplitude.ts`, `web/src/lib/flow/state.ts`, `web/src/lib/flow/storage.ts`, `web/src/lib/flow/api.ts`, `web/src/components/flow/Flow.tsx`, `web/src/components/flow/Home.tsx`, `web/src/components/flow/Home.module.css`, `web/src/components/flow/BookScene.tsx`, `web/src/components/flow/FirstPage.tsx`, `web/src/components/flow/FlowRoot.tsx`, `web/src/app/page.tsx`, `web/e2e/guard.spec.ts`
- Test (modify): `web/src/lib/track/{schema,props,client,amplitude,common}.test.ts`, `web/src/lib/track/taxonomy.test.ts`(공통 표본), `web/src/app/api/track/route.test.ts`, `web/src/lib/flow/{state,storage,api}.test.ts`, `web/src/components/flow/{Home,BookScene}.test.tsx`
- Delete: `web/src/components/flow/{TargetInput.tsx,TargetInput.test.tsx,TargetInput.module.css,BalanceGame.tsx,BalanceGame.test.tsx,BalanceGame.module.css,FirstPage.test.tsx}`, `web/src/lib/flow/{order.ts,order.test.ts,questions.ts,questions.test.ts,summary.ts,summary.test.ts,target.ts,target.test.ts}`, `web/e2e/{flow-leaf.spec.ts,flow-target.spec.ts,understood.spec.ts}`

**Interfaces:**
- Consumes: Task 3·4·5의 모든 것. 서버는 `entry` 없는 `{ answers, seen }`을 이미 받는다(Task 4).
- Produces (이벤트, taxonomy v1.0):
  - E-32 `question_answered` `{ node_id: string; kind: "narrow"|"mood"; choice: "A"|"B"|"unsure"; depth: number; position: number; elapsed_ms: number }`
  - E-25 `unsure_hold_cancelled` `{ node_id: string; depth: number; held_ms: number }`
  - E-33 `question_back_clicked` `{ node_id: string; depth: number; source: "question"|"first_page" }`
  - E-34 `path_completed` `{ scope_id: string; depth: number; unsure_count: number }`
  - E-20 `home_clicked.source`에 `"question"` 추가
  - 공통: `mode: "normal"|"challenge"|null` (COMMON_KEYS에서 `entry` 다음), `entry` 뜻 = 갈래, `SCREEN_VERSION = "v2"`
  - `removed`: E-03 `chip_selected`, E-06 `first_page_edited`, E-21 `free_goal_written`, E-22 `goal_coverage_checked`, E-24 `balance_answered`, E-26 `goal_submitted`
  - `setMode(next: "normal"|"challenge"|null): void` (`lib/track/common.ts`)
- Produces (흐름):
  - `type Step = "home" | "questions" | "book" | "first" | "bookmarks" | "result" | "end"`
  - `FlowState { step; answers: Answer[]; asked: number; drawnFor: Answer[] | null; status; drawId; draw: DrawView | null; opened; index; reactions; result; seen }`
  - `DrawView { picks: PickView[]; exhausted: boolean; path: PathSummary }`
  - `FlowAction`: `start` · `answer {choice}` · `back` · `drawn` · `drawFailed` · `retry` · `open` · `next` · `react` · `nextResult` · `prevResult` · `redraw` · `home`
  - 저장 `VERSION = 6`
  - `<Home onStart: () => void library? />`, `START_LABEL = "갈피 잡으러 가기"`, `START_NOTE = "질문 몇 개면 한 권을 만나요"`
  - `<BookScene state onOpen onBack onNext onRetry onReact onHome />`, `BACK_TO_QUESTIONS = "질문으로 돌아가기"`
  - `<FirstPageTitle />` 제목 "당신이 고른 길"

- [ ] **Step 1: taxonomy.md v1.0**

`docs/taxonomy.md`:
1. 맨 위 버전 표 끝에 줄:
```markdown
| taxonomy v1.0 | 2026-10-04 | v2 설계 `plans/2026-10-04-galpi-v2-paths-design.md` 6절 · 계획 2 | 갈림길 이벤트 E-32·E-33·E-34, E-25 속성 교체, 공통 `mode`·`entry`=갈래·`screen_version` v2, 🎯 입력·밸런스 이벤트 6개 `removed` (8절) |
```
2. 2-5 표의 `| 밸런스게임 | S-02 🍃 | E-24, E-25 |` 줄과 `목표입력` 줄을 바꾼다:
```markdown
| 갈림길 | S-02 | E-32, E-25, E-33, E-34 (v1.0) |
| ~~밸런스게임~~ · ~~목표입력~~ | ~~S-02 🍃 · 🎯~~ | v1.0 없앰 — E-24, E-03·E-26·E-21·E-22 (`removed`) |
```
3. 3-1 표: `entry` 줄 바꾸고 바로 아래 `mode` 줄을 넣는다:
```markdown
| `entry` | v1.0: 뜻만 바뀜 | String \| null | **갈래** — 두 번째 질문의 답. `leaf`=이야기에 빠지기, `target`=뭔가 배우기. 고르기 전·갈피를 못 잡겠어요(섞어서)·처음으로 뒤는 null. 도전이어도 고른 갈래 그대로. 값이 v1 입구(🍃=leaf, 🎯=target)와 같아 v1 기록과 이어 볼 수 있다 | common | 이벤트 속성 (null이면 생략) |
| `mode` | 추가 (v1.0) | String \| null | **길의 모드** — 첫 질문의 답. `normal`=평소 끌리는 쪽(갈피를 못 잡겠어요도), `challenge`=오늘은 낯선 쪽으로 도전. 첫 답 전·처음으로 뒤는 null | common | 이벤트 속성 (null이면 생략) |
```
   `screen_version` 줄의 뜻 칸 끝에 `— v1.0부터 \`v2\``.
4. 3-1a 표: `첫 장 [한 번 고치기] → 재뽑기, …` 줄의 앞부분을 `S-04 [← 질문으로 돌아가기] → 다시 답해 재뽑기(같은 답이면 같은 다섯 장), …`로; F-24 ③ 줄의 첫 칸 앞에 `~~` … `~~`를 씌우고 끝 칸에 ` — v1.0 없앰`. 새 줄을 넣는다:
```markdown
| S-02 **첫 질문**의 [← 이전 질문] — 처음 화면으로 (v1.0) | **+1** — E-20(`source`=question)을 보낸 직후. 그 판은 답이 하나도 없이 끝난다 |
```
5. 4-1 표: 상태 줄을 `상태 (v1.0): live 27 · removed 6 · planned 0.`로 시작하게 바꾸고, E-24·E-03·E-26·E-21·E-22·E-06 줄의 상태를 `removed`로, E-25 줄의 분류를 `갈림길`로. E-25 줄 아래에 넣는다:
```markdown
| E-32 | `question_answered` | (없음, v1.0 — E-24 대신) | 갈림길 | click | live |
| E-33 | `question_back_clicked` | (없음, v1.0) | 갈림길 | click | live |
| E-34 | `path_completed` | (없음, v1.0) | 갈림길 | system | live |
```
   표 아래 문단 `(30개 — \`EVENT_NAMES\`는 그 키, v0.10)` → `(27개 — \`EVENT_NAMES\`는 그 키, v1.0. \`removed\` 6개는 csv·이 문서에 기록으로만)`.
6. 4-2: E-24 절 머리 표의 `live` → `removed`, 그 아래 `**언제**` 앞에 `**v1.0 (2026-10-04) 없앰** — 9문항 밸런스 게임이 질문 지도로 바뀜. v1 기록(\`screen_version\`=v1)을 읽을 때만 쓴다. 새 답은 E-32.  `. E-03·E-26·E-21·E-22·E-06 절도 같은 방식(상태 `removed`, `**v1.0 (2026-10-04) 없앰** — 🎯 입력·직접 쓰기·F-24·한 번 고치기를 없앰(PRD v2).` 한 줄). 속성 표는 그대로 둔다(검사 #11이 csv와 맞춰 본다).
7. E-02 절의 `**언제**` 문장을 `**언제**: S-01 [갈피 잡으러 가기]를 누를 때(source=home). v1.0부터 first_page 값은 나오지 않는다(F-24 ③ 없앰). 누르기 직전에 공통 entry·mode가 null로 정해지고, 갈래·모드는 질문에 답하며 정해진다`로.
8. E-25 절 전체를 바꾼다:
```markdown
#### E-25 `unsure_hold_cancelled`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 갈림길 | click | live | v1.0: 속성 교체 (question_no·position·is_edit → node_id·depth) |

**언제**: S-02 [갈피를 못 잡겠어요]를 누르다 0.8초가 되기 전에 뗄 때 (망설임)  
**분석 질문**: 설계 6절 ① 헷갈리는 질문

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `node_id` | 추가 (v1.0) | String | "learn-area" | 그 질문의 id (docs/question-map.md) |
| `depth` | 추가 (v1.0) | Number | 1, 4 | 지금 길에서 몇 번째 질문인지 (1부터) |
| `held_ms` | 같음 | Number | 350 | 누르고 있던 시간 (ms, 800 미만) |
```
9. E-25 절 바로 아래에 세 절:
```markdown
#### E-32 `question_answered`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 갈림길 | click | live | 추가 (v1.0 — E-24 `balance_answered` 대신. 이름을 바꿔 v1 9문항과 섞이지 않게) |

**언제**: S-02에서 선택지 카드를 누를 때(질문이 뜬 뒤 250ms 안의 누름은 무시) 또는 [갈피를 못 잡겠어요]를 0.8초 꾹 눌러 넘어갈 때. 질문마다 1번 — 되돌아가 다시 답하면 또 남는다. 보낼 때의 공통 entry·mode는 이 답 **전** 값(갈래·모드 질문의 답은 `choice`로 읽는다)  
**분석 질문**: 설계 6절 ① 어디까지 좁히나·헷갈리는 질문(질문별 unsure 비율) ② 좁힐수록 궁금해요가 느나

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `node_id` | 추가 (v1.0) | String | "start", "learn-data-tool" | 질문 지도의 질문 id (docs/question-map.md). 질문 문장이 바뀌어도 id는 그대로 |
| `kind` | 추가 (v1.0) | String | "narrow", "mood" | 질문 종류 — narrow=좁히기(범위를 줄임), mood=기분(점수만) |
| `choice` | 추가 (v1.0) | String | "A", "B", "unsure" | 고른 답. A·B는 question-map.md의 A·B 줄. unsure=갈피를 못 잡겠어요 |
| `depth` | 추가 (v1.0) | Number | 1, 11 | 지금 길에서 몇 번째 질문인지 (1부터). 되돌아가 다시 답하면 같은 depth |
| `position` | 추가 (v1.0) | Number | 1, 14 | 이 판에서 몇 번째로 낸 답인지 (1부터, 되돌아가 다시 낸 답도 셈) |
| `elapsed_ms` | 추가 (v1.0) | Number | 2400 | 질문이 보인 뒤 답할 때까지 걸린 시간 (ms) |

#### E-33 `question_back_clicked`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 갈림길 | click | live | 추가 (v1.0) |

**언제**: S-02 [← 이전 질문](두 번째 질문부터 — 첫 질문에서는 E-20 source=question) 또는 S-04 [← 질문으로 돌아가기]를 누를 때. 마지막 답 하나를 지운다  
**분석 질문**: 설계 6절 ① 헷갈리는 질문(질문별 되돌리기 비율)

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `node_id` | 추가 (v1.0) | String | "branch" | 다시 답하게 되는 질문 = 지운 답의 질문 id |
| `depth` | 추가 (v1.0) | Number | 2, 11 | 그 질문의 depth (= 지우기 전 답 수) |
| `source` | 추가 (v1.0) | String | "question", "first_page" | 누른 화면 — question=S-02 [← 이전 질문], first_page=S-04 [← 질문으로 돌아가기] |

#### E-34 `path_completed`

| 분류 | 트리거 | 상태 | 현재 → 제안 |
|---|---|---|---|
| 갈림길 | system | live | 추가 (v1.0) |

**언제**: 마지막 질문에 답해 길이 끝났을 때(뽑기를 부르기 직전, E-32 바로 뒤). S-04에서 돌아가 다시 끝내도 그때마다 남는다. 모드·갈래는 공통 `mode`·`entry`가 싣는다(2-3: 공통 이름을 이벤트 속성으로 다시 쓰지 않음)  
**분석 질문**: 설계 6절 ④ 도전 vs 일반 ⑤ 책이 모자란 길 — `scope_id`로 `npm run map:coverage` 표와 이어 본다

| 속성 | 현재 → 제안 | 타입 | 값 | 설명 |
|---|---|---|---|---|
| `scope_id` | 추가 (v1.0) | String | "entry=target;topics=데이터 분석;keywords=SQL", "all" | 뽑는 범위 id — 도전이면 먼 곳으로 바꾼 뒤. `npm run map:coverage`의 scope 열과 같은 값(`scopeKey`) |
| `depth` | 추가 (v1.0) | Number | 3, 11 | 길의 질문 수 (= 답 수) |
| `unsure_count` | 추가 (v1.0) | Number | 0, 2 | 그 길에서 갈피를 못 잡겠어요를 고른 수 |
```
10. E-20 절: `**언제**` 끝에 ` v1.0: S-02 첫 질문의 [← 이전 질문]도(source=question — 처음 화면으로, 새 판)`. 속성 표 `source` 줄의 값 칸을 `"first_page", "end", "question"`으로, 설명 끝에 `, question=S-02 첫 질문의 이전 질문(v1.0)`.
11. 5-2 퍼널: FN-1·FN-2 두 줄 아래에 넣는다:
```markdown
| FN-7 | 메인 v2 (v1.0) | `site_visited` → `entry_selected` → `question_answered`(depth=1) → `path_completed` → `book_opened` → `bookmark_shown`(1) → `bookmark_reacted`(5) → `result_viewed` → `yes24_link_clicked`(result) | 세션 | 설계 6절 |
```
    그리고 FN-1·FN-2 줄 첫 칸 뒤에 ` (v1 — screen_version=v1만)`. 5-3 표 끝에:
```markdown
| 질문별 못 잡겠어요·되돌리기 (v1.0) | node_id별 `question_answered` choice=unsure 비율, `question_back_clicked` 수 / 그 질문의 답 수, `unsure_hold_cancelled` 수 / 답 수 | node_id, kind | 설계 6절 ① |
| 좁힌 깊이별 반응 (v1.0) | 판의 `path_completed.depth`·scope_id별 궁금해요율·5장 완주율 | mode | 설계 6절 ②·④·⑤ |
```
12. 6-1의 `직접 쓰기(E-21 \`goal_text\`, … )와 갈피 우체통` → `갈피 우체통(E-31 \`feedback_text\`, 500자, v0.10 — Supabase에만)` (v1.0부터 직접 쓰기 글은 받지 않는다; 옛 E-21 기록은 1년 자동 삭제). 6-2 표의 `goal_text`·`missing_text` 줄 첫 칸 뒤에 ` (v1.0 없앰 — 남은 기록은 1년 뒤 삭제)`.
13. 8절 변경 기록 끝에:
```markdown
| v1.0 | 2026-10-04 | Claude (v2 계획 2) | 갈피 v2(입구 하나, 둘 중 하나 고르는 갈림길). **새로**: E-32 `question_answered`(node_id·kind·choice·depth·position·elapsed_ms — E-24 대신, 이름을 바꿔 v1과 섞이지 않게), E-33 `question_back_clicked`(node_id·depth·source), E-34 `path_completed`(scope_id·depth·unsure_count), 공통 `mode`. **바꿈**: E-25 `unsure_hold_cancelled` 속성 question_no·position·is_edit → node_id·depth, 분류 갈림길. E-20 `source`에 "question"(첫 질문의 이전 질문 → 새 판, 3-1a). 공통 `entry` 뜻 = 갈래(값 그대로), `screen_version` v2. **없앰(`removed`, 줄은 기록으로)**: E-03 `chip_selected`, E-26 `goal_submitted`, E-21 `free_goal_written`, E-22 `goal_coverage_checked`, E-06 `first_page_edited`, E-24 `balance_answered`. E-02 `source`=first_page와 E-18 `source`=first_page 값은 더 나오지 않지만 v1 기록을 읽으려고 스펙에 남김. 처리방침 6-3f를 먼저. v1 기준점과는 책갈피 이후 이벤트(공통)로만 비교(설계 9절) |
```

- [ ] **Step 2: taxonomy.csv v1.0**

`docs/taxonomy.csv` (UTF-8 BOM 유지, 13칸):
1. 공통 `entry` 줄(6행)을 바꾸고 바로 아래에 `mode` 줄을 넣는다:
```csv
-,공통,SDK,*,모든 이벤트에 붙는 공통 속성 (lib/track/common.ts),entry,"갈래 — 두 번째 질문의 답. leaf=이야기에 빠지기, target=뭔가 배우기. 고르기 전·갈피를 못 잡겠어요(섞어서)·처음으로 뒤는 null",FALSE,String,"null, ""leaf"", ""target""","v1.0: 뜻이 입구(🍃/🎯)에서 갈래로, 값은 그대로(v1 leaf=🍃 입구). 도전이어도 고른 갈래 그대로. Amplitude 이벤트 속성(null이면 생략)",COMMON,live
-,공통,SDK,*,모든 이벤트에 붙는 공통 속성 (lib/track/common.ts),mode,"길의 모드 — 첫 질문의 답. normal=평소 끌리는 쪽(갈피를 못 잡겠어요도), challenge=오늘은 낯선 쪽으로 도전. 첫 답 전·처음으로 뒤는 null",FALSE,String,"null, ""normal"", ""challenge""","v1.0 추가. Amplitude 이벤트 속성(null이면 생략)",COMMON,live
```
   `screen_version` 줄의 Note 칸 → `Amplitude 이벤트 속성으로도 보냄. v1.0부터 v2`.
2. E-02 줄의 Event Description을 `"S-01 [갈피 잡으러 가기]를 누를 때(source=home). v1.0부터 first_page는 나오지 않음(F-24 ③ 없앰). 누르기 직전에 공통 entry·mode가 null로 정해짐"`로.
3. E-24(`balance_answered`) 6줄, E-03(`chip_selected`) 3줄, E-26(`goal_submitted`) 5줄, E-21(`free_goal_written`) 7줄, E-22(`goal_coverage_checked`) 3줄, E-06(`first_page_edited`) 1줄의 마지막 칸 `live` → `removed`.
4. E-25 4줄을 지우고 그 자리에 E-25 3줄 + E-32 6줄 + E-33 3줄 + E-34 3줄을 넣는다:
```csv
click,갈림길,SDK,unsure_hold_cancelled,[갈피를 못 잡겠어요]를 누르다 0.8초가 되기 전에 뗄 때 (망설임),node_id,그 질문의 id (docs/question-map.md),FALSE,String,"""learn-area""",v1.0 · question_no·position·is_edit 대신,E-25,live
click,갈림길,SDK,unsure_hold_cancelled,[갈피를 못 잡겠어요]를 누르다 0.8초가 되기 전에 뗄 때 (망설임),depth,지금 길에서 몇 번째 질문인지 (1부터),FALSE,Number,"1, 4",v1.0 추가,E-25,live
click,갈림길,SDK,unsure_hold_cancelled,[갈피를 못 잡겠어요]를 누르다 0.8초가 되기 전에 뗄 때 (망설임),held_ms,"누르고 있던 시간 (ms, 800 미만)",FALSE,Number,350,,E-25,live
click,갈림길,SDK,question_answered,S-02에서 선택지 카드를 누를 때(질문이 뜬 뒤 250ms 안의 누름은 무시) 또는 [갈피를 못 잡겠어요]를 0.8초 꾹 눌러 넘어갈 때. 질문마다 1번 — 되돌아가 다시 답하면 또 남음,node_id,질문 지도의 질문 id (docs/question-map.md). 질문 문장이 바뀌어도 id는 그대로,FALSE,String,"""start"", ""learn-data-tool""",v1.0 추가 (E-24 대신),E-32,live
click,갈림길,SDK,question_answered,S-02에서 선택지 카드를 누를 때(질문이 뜬 뒤 250ms 안의 누름은 무시) 또는 [갈피를 못 잡겠어요]를 0.8초 꾹 눌러 넘어갈 때. 질문마다 1번 — 되돌아가 다시 답하면 또 남음,kind,질문 종류 — narrow=좁히기 / mood=기분,FALSE,String,"""narrow"", ""mood""",v1.0 추가,E-32,live
click,갈림길,SDK,question_answered,S-02에서 선택지 카드를 누를 때(질문이 뜬 뒤 250ms 안의 누름은 무시) 또는 [갈피를 못 잡겠어요]를 0.8초 꾹 눌러 넘어갈 때. 질문마다 1번 — 되돌아가 다시 답하면 또 남음,choice,고른 답. A·B는 question-map.md의 A·B 줄. unsure=갈피를 못 잡겠어요,FALSE,String,"""A"", ""B"", ""unsure""",대문자 A·B는 명명 규칙의 예외 (문서 표기와 맞춤),E-32,live
click,갈림길,SDK,question_answered,S-02에서 선택지 카드를 누를 때(질문이 뜬 뒤 250ms 안의 누름은 무시) 또는 [갈피를 못 잡겠어요]를 0.8초 꾹 눌러 넘어갈 때. 질문마다 1번 — 되돌아가 다시 답하면 또 남음,depth,지금 길에서 몇 번째 질문인지 (1부터). 되돌아가 다시 답하면 같은 depth,FALSE,Number,"1, 11",v1.0 추가,E-32,live
click,갈림길,SDK,question_answered,S-02에서 선택지 카드를 누를 때(질문이 뜬 뒤 250ms 안의 누름은 무시) 또는 [갈피를 못 잡겠어요]를 0.8초 꾹 눌러 넘어갈 때. 질문마다 1번 — 되돌아가 다시 답하면 또 남음,position,"이 판에서 몇 번째로 낸 답인지 (1부터, 되돌아가 다시 낸 답도 셈)",FALSE,Number,"1, 14",v1.0 추가,E-32,live
click,갈림길,SDK,question_answered,S-02에서 선택지 카드를 누를 때(질문이 뜬 뒤 250ms 안의 누름은 무시) 또는 [갈피를 못 잡겠어요]를 0.8초 꾹 눌러 넘어갈 때. 질문마다 1번 — 되돌아가 다시 답하면 또 남음,elapsed_ms,질문이 보인 뒤 답할 때까지 걸린 시간 (ms),FALSE,Number,2400,v1.0 추가,E-32,live
click,갈림길,SDK,question_back_clicked,S-02 [← 이전 질문](두 번째 질문부터) 또는 S-04 [← 질문으로 돌아가기]를 누를 때. 마지막 답 하나를 지움,node_id,다시 답하게 되는 질문 = 지운 답의 질문 id,FALSE,String,"""branch""",v1.0 추가,E-33,live
click,갈림길,SDK,question_back_clicked,S-02 [← 이전 질문](두 번째 질문부터) 또는 S-04 [← 질문으로 돌아가기]를 누를 때. 마지막 답 하나를 지움,depth,그 질문의 depth (= 지우기 전 답 수),FALSE,Number,"2, 11",v1.0 추가,E-33,live
click,갈림길,SDK,question_back_clicked,S-02 [← 이전 질문](두 번째 질문부터) 또는 S-04 [← 질문으로 돌아가기]를 누를 때. 마지막 답 하나를 지움,source,누른 화면 — question=S-02 / first_page=S-04,FALSE,String,"""question"", ""first_page""",v1.0 추가,E-33,live
system,갈림길,SDK,path_completed,마지막 질문에 답해 길이 끝났을 때(뽑기를 부르기 직전). S-04에서 돌아가 다시 끝내도 그때마다 남음. 모드·갈래는 공통 mode·entry,scope_id,뽑는 범위 id — 도전이면 먼 곳으로 바꾼 뒤. npm run map:coverage의 scope 열과 같은 값,FALSE,String,"""entry=target;topics=데이터 분석;keywords=SQL"", ""all""",v1.0 추가,E-34,live
system,갈림길,SDK,path_completed,마지막 질문에 답해 길이 끝났을 때(뽑기를 부르기 직전). S-04에서 돌아가 다시 끝내도 그때마다 남음. 모드·갈래는 공통 mode·entry,depth,길의 질문 수 (= 답 수),FALSE,Number,"3, 11",v1.0 추가,E-34,live
system,갈림길,SDK,path_completed,마지막 질문에 답해 길이 끝났을 때(뽑기를 부르기 직전). S-04에서 돌아가 다시 끝내도 그때마다 남음. 모드·갈래는 공통 mode·entry,unsure_count,그 길에서 갈피를 못 잡겠어요를 고른 수,FALSE,Number,"0, 2",v1.0 추가,E-34,live
```
5. E-20 두 줄의 Event Description을 `"[처음으로]를 누를 때 — S-04(뽑기 실패·책 없음)와 S-08 마무리, 그리고 S-02 첫 질문의 [← 이전 질문](v1.0). 이벤트는 끝나는 판의 round를 싣고, 보낸 직후 round +1 — 같은 탭에서 다시 시작하면 새 판 (3-1a)"`로, `source` 줄의 Value Example을 `"""first_page"", ""end"", ""question"""`로, Note를 `"v0.3 반영 · 추가 / first_page=S-04(막다른 길), end=마무리, question=S-02 첫 질문의 이전 질문(v1.0)"`로.

- [ ] **Step 3: schema.ts**

`web/src/lib/track/schema.ts`:
1. 상수: `IS_EDIT`와 `QUESTION_NO`를 지우고 넣는다:
```ts
const NODE_ID = { type: "string" } as const;
const DEPTH = { type: "number" } as const;
```
2. `EVENT_SPEC`에서 `chip_selected`, `first_page_edited`, `free_goal_written`, `goal_coverage_checked`, `balance_answered`, `goal_submitted`를 지운다. `entry_selected` 바로 아래에 넣는다:
```ts
  question_answered: {
    node_id: NODE_ID,
    kind: { type: ["narrow", "mood"] },
    choice: { type: ["A", "B", "unsure"] },
    depth: DEPTH,
    position: POSITION,
    elapsed_ms: { type: "number" },
  },
  unsure_hold_cancelled: { node_id: NODE_ID, depth: DEPTH, held_ms: { type: "number" } },
  question_back_clicked: { node_id: NODE_ID, depth: DEPTH, source: { type: ["question", "first_page"] } },
  path_completed: { scope_id: { type: "string" }, depth: DEPTH, unsure_count: { type: "number" } },
```
   (원래 아래쪽의 `unsure_hold_cancelled` 줄은 지운다.) `home_clicked`의 `source`를 `{ type: ["first_page", "end", "question"] }`로.
3. `CommonProps`에 `entry` 아래 `mode: "normal" | "challenge" | null;`. `COMMON_KEYS`를:
```ts
export const COMMON_KEYS = [
  "anon_id", "user_id", "session_id", "round", "entry", "mode", "screen_version", "referrer", "is_returning", "device", "is_in_app_browser",
] as const satisfies readonly (keyof CommonProps)[];
```
4. `export const SCREEN_VERSION = "v2";`
5. `parseCommon`: 구조분해에 `mode`를 더하고, `entry` 검사 아래에 `if (mode !== null && mode !== "normal" && mode !== "challenge") return null;`, 반환 객체의 `entry,` 뒤에 `mode,`.

- [ ] **Step 4: common.ts · amplitude.ts**

`web/src/lib/track/common.ts`:
```ts
const MODE = "galpi.mode";
…
function currentMode(): CommonProps["mode"] {
  const value = readSession(MODE);
  return value === "normal" || value === "challenge" ? value : null;
}
…
export function setMode(next: CommonProps["mode"]): void { writeSession(MODE, next ?? ""); }
```
(`const ROUND = …` 아래, `currentRound` 아래, `setEntry` 아래에 각각.) `commonProps()` 반환의 `entry: currentEntry(),` 아래에 `mode: currentMode(),`. 주석 `// entry and round live in sessionStorage` → `// entry, mode and round live in sessionStorage`.

`web/src/lib/track/amplitude.ts`의 `shared` 객체 `...(common.entry === null ? {} : { entry: common.entry }),` 아래에:
```ts
      ...(common.mode === null ? {} : { mode: common.mode }),
```

- [ ] **Step 5: track 테스트 고치기 (문서가 먼저 바뀌었으므로 따라감)**

아래 바꾸기를 한다(왼쪽 → 오른쪽).

`web/src/lib/track/schema.test.ts`:
- 첫 테스트 전체:
```ts
  it("lists the 27 live taxonomy events in PRD order (v1.0: six removed, E-32 · E-25 · E-33 · E-34 after E-02)", () => {
    expect(EVENT_NAMES).toHaveLength(27);
    expect(EVENT_NAMES.slice(0, 6)).toEqual(["site_visited", "entry_selected", "question_answered", "unsure_hold_cancelled", "question_back_clicked", "path_completed"]);
    expect(EVENT_NAMES.slice(-5)).toEqual(["bookmark_pulled", "bookmark_flipped", "shelf_created", "bookmark_moved", "feedback_sent"]);
    for (const gone of ["visit", "balance_answered", "chip_selected", "goal_submitted", "free_goal_written", "goal_coverage_checked", "first_page_edited"]) {
      expect(EVENT_NAMES).not.toContain(gone);
    }
  });
```
- `"marks goal_text Supabase only …"` 테스트 이름과 첫 줄: `"marks feedback_text Supabase only and prompt_version Amplitude only (taxonomy 2-7)"`, `free_goal_written.goal_text` 줄 삭제.
- `"F-24: the missing phrase …"` 테스트 전체를 바꾼다:
```ts
  it("v1.0: the question events and the extra home source; old first_page values stay readable", () => {
    expect(EVENT_SPEC.question_answered.kind.type).toEqual(["narrow", "mood"]);
    expect(EVENT_SPEC.question_back_clicked.source.type).toEqual(["question", "first_page"]);
    expect(EVENT_SPEC.home_clicked.source.type).toEqual(["first_page", "end", "question"]);
    expect(EVENT_SPEC.path_completed.scope_id).toEqual({ type: "string" });
    expect(EVENT_SPEC.yes24_link_clicked.source.type).toContain("first_page");
    expect(EVENT_SPEC.entry_selected.source.type).toEqual(["home", "first_page"]);
  });
```
- 타입 테스트: `const goal: PropsOf<"free_goal_written"> = {…};` 를
```ts
    const answered: PropsOf<"question_answered"> = { node_id: "start", kind: "narrow", choice: "unsure", depth: 1, position: 1, elapsed_ms: 900 };
```
  로, 마지막 `// @ts-expect-error — side is an enum…` 두 줄을
```ts
    // @ts-expect-error — kind is an enum: narrow or mood
    const side: PropsOf<"question_answered"> = { node_id: "start", kind: "both", choice: "A", depth: 1, position: 1, elapsed_ms: 1 };
```
  로, `expect([shown, goal, …])` → `expect([shown, answered, visit, old, entry, side]).toHaveLength(6);`
- `const good = { … entry: null, screen_version: "v1", …}` → `entry: null, mode: null, screen_version: "v2",`. `rejects %s` 표에 두 줄: `["mode unknown", { mode: "both" }],`, `["mode undefined", { mode: undefined }],`. `"accepts a complete common block…"`의 두 번째 expect에 `mode: "challenge",`를 넣고 `toMatchObject({ entry: "leaf", mode: "challenge", user_id: "u1" })`.

`web/src/lib/track/props.test.ts`:
- `const chip = …; expect(parseProps("chip_selected", chip))…` 두 줄 →
```ts
    const answered = { node_id: "learn-area", kind: "narrow", choice: "unsure", depth: 4, position: 5, elapsed_ms: 1200 };
    expect(parseProps("question_answered", answered)).toEqual({ props: answered, dropped: [] });
```
- `drops %s` 표의 줄을 바꾼다: `"balance_answered", { elapsed_ms: … }` → `"question_answered", { elapsed_ms: Number.POSITIVE_INFINITY }`; `["a boolean sent as a string", "chip_selected", { is_edit: "false" }]` → `["a boolean sent as a string", "save_clicked", { is_logged_in: "false" }]`; `["null where the spec has no null", "goal_submitted", { topic: null }]` → `["null where the spec has no null", "question_answered", { node_id: null }]`; `["a string that is not an enum value", "goal_submitted", { len: 1 }]` → `["a value that is not an enum value", "question_answered", { kind: 1 }]`; `["a string for a list", "first_page_edited", { changed_items: "len" }]`·`["a list with a number in it", "free_goal_written", …]`·`["a list with null in it", "first_page_edited", …]`·`["a list longer than 20", "free_goal_written", …]` 네 줄 →
```ts
    ["a list for a string", "bookmark_moved", { book_id: ["9788998441012"] }],
```
  (리스트 속성 검사는 `parseProps`가 이 타입을 쓰는 이벤트가 생길 때 다시 — 지금 live 이벤트에 Array 속성이 없다. `props.ts`의 배열 분기는 커버리지 임계 밖이다.)
- `"accepts null where the spec allows it"`: `balance_answered`/`chip_selected`/`free_goal_written` 세 expect 줄을 지운다(남는 것: `yes24_link_clicked` 두 줄).
- `"cuts goal_text to its 30 characters …"` 전체 →
```ts
  it("cuts feedback_text to its 500 characters and other free strings to 200", () => {
    const { props } = parseProps("feedback_sent", { feedback_text: "가".repeat(600), text_length: 600 });
    expect(props).toEqual({ feedback_text: "가".repeat(500), text_length: 600 });
    expect(parseProps("path_completed", { scope_id: "x".repeat(300) }).props).toEqual({ scope_id: "x".repeat(200) });
  });
```
- `forAmplitude` describe: `"leaves out goal_text …"`·`"F-24: leaves out missing_text …"` 두 테스트 삭제. `"keeps only the keys the event's spec defines …"`의 `sent`/expect 두 줄 →
```ts
    const sent = { node_id: "start", kind: "narrow", choice: "A", depth: 1, position: 1, elapsed_ms: 5, note: "free text", constructor: "c" };
    expect(forAmplitude("question_answered", sent)).toEqual({ node_id: "start", kind: "narrow", choice: "A", depth: 1, position: 1, elapsed_ms: 5 });
```

`web/src/lib/track/client.test.ts`:
- `track("first_page_edited", { changed_items: ["len"] });` / `expect(data.name).toBe("first_page_edited");` / `expect(data.props).toEqual({ changed_items: ["len"] });` → `track("question_back_clicked", { node_id: "branch", depth: 2, source: "question" });` / `"question_back_clicked"` / `{ node_id: "branch", depth: 2, source: "question" }`.
- `track("chip_selected", { chip_type: "len", chip_value: "thin", is_edit: false });` 와 그 테스트의 `"chip_selected"`·props expect → `track("path_completed", { scope_id: "all", depth: 3, unsure_count: 1 });`, `"path_completed"`, `{ scope_id: "all", depth: 3, unsure_count: 1 }`.
- round 테스트의 `track("goal_submitted", …); track("first_page_edited", …);` 두 줄 → `track("question_answered", { node_id: "start", kind: "narrow", choice: "A", depth: 1, position: 1, elapsed_ms: 10 }); track("path_completed", { scope_id: "all", depth: 3, unsure_count: 1 });`, 테스트 이름 `"keeps the round for every other event — going back and a new draw stay in the same round"`.

`web/src/lib/track/amplitude.test.ts`:
- `common` 고정값(27~28행)의 `entry: "leaf",` 뒤에 `mode: "normal",`.
- `"keeps at most 50 waiting events"`의 루프와 마지막 expect를 바꾼다:
```ts
    for (let i = 0; i < 80; i++) sendToAmplitude("question_answered", { node_id: `n${i}`, kind: "mood", choice: "A", depth: 1, position: i + 1, elapsed_ms: 1 }, common);
    …
    expect(sdk.track.mock.calls[0][1].node_id).toBe("n0");
```
- `"sends the same event name and props plus …"` 전체 →
```ts
  it("sends the same event name and props plus the analysis-relevant common props", async () => {
    const send = await started();
    send("question_back_clicked", { node_id: "branch", depth: 2, source: "question" }, common);
    expect(sdk.track).toHaveBeenCalledTimes(1);
    expect(sdk.track).toHaveBeenCalledWith("question_back_clicked", {
      entry: "leaf", mode: "normal", round: 2, screen_version: "v1", device: "phone", is_in_app_browser: false, is_returning: true,
      node_id: "branch", depth: 2, source: "question",
    }, { time: expect.any(Number) });
  });
```
  (`common` 고정값의 screen_version은 "v1" 그대로 — 고정값을 그대로 보내는지 보는 테스트다.)
- `"sends free_goal_written without goal_text …"`·`"… without missing_text …"` 두 테스트 삭제.
- `"leaves out entry when the visitor has not chosen one yet"` 아래에 추가:
```ts
  it("leaves out mode before the first answer", async () => {
    const send = await started();
    send("site_visited", {}, { ...common, mode: null });
    expect(sdk.track.mock.calls[0][1]).not.toHaveProperty("mode");
  });
```
- `"sends props alone when common props are unavailable"`의 `own`과 이름 → `const own = { node_id: "start", depth: 1, held_ms: 300 }; send("unsure_hold_cancelled", own, null); expect(sdk.track).toHaveBeenCalledWith("unsure_hold_cancelled", own, …)`.

`web/src/lib/track/common.test.ts`: `"carries entry and round"` 테스트 아래에 추가하고 import에 `setMode`를 더한다:
```ts
  it("carries the route (mode) and clears it back to null (taxonomy v1.0)", () => {
    setMode("challenge");
    expect(commonProps().mode).toBe("challenge");
    setMode(null);
    expect(commonProps().mode).toBeNull();
  });
```

`web/src/lib/track/taxonomy.test.ts` #8의 `sample`에 `mode: null,`을 `entry: null,` 뒤에 넣는다(공통 키가 문서에서 늘었으므로).

`web/src/app/api/track/route.test.ts`:
- 13행 `common`에 `mode: null,` (`entry: null,` 뒤).
- `"keeps the event and strips NUL and lone surrogates …"` 전체 →
```ts
  it("keeps the event and strips NUL and lone surrogates that Postgres jsonb would refuse", async () => {
    const dirty = { ...common, referrer: "a\u0000b\ud800c" };
    const props = { node_id: "lea\u0000rn\udc00", kind: "narrow", choice: "A", depth: 1, position: 1, elapsed_ms: 5, "\u0000k": 1 };
    const res = await POST(req({ name: "question_answered", props, common: dirty }));
    expect(res.status).toBe(202);
    expect(saveEvent).toHaveBeenCalledWith({
      name: "question_answered",
      props: { node_id: "learn�", kind: "narrow", choice: "A", depth: 1, position: 1, elapsed_ms: 5 },
      common: { ...common, referrer: "ab�c" },
    });
  });
```
  (옛 테스트가 `free_goal_written`의 문자열 속성으로 보던 것을 `question_answered.node_id`로 본다. NUL은 지워지고 외톨이 서로게이트는 U+FFFD — 옛 기대값과 같은 규칙.)
- `"keeps the goal text to 30 characters …"` 전체 →
```ts
  it("keeps a free string prop to 200 characters and logs nothing when every prop matches", async () => {
    const props = { scope_id: "가".repeat(250), depth: 3, unsure_count: 0 };
    expect((await POST(req({ name: "path_completed", props, common }))).status).toBe(202);
    expect(vi.mocked(saveEvent).mock.calls[0][0].props.scope_id).toBe("가".repeat(200));
    expect(warn).not.toHaveBeenCalled();
  });
```

`web/e2e/guard.spec.ts` 4행 `common`에 `mode: null,` (`entry: null,` 뒤), `screen_version: "v1"` → `"v2"`.

- [ ] **Step 6: taxonomy 검사로 문서 ↔ 코드 확인 (track() 전)**

Run: `npx vitest run src/lib/track`
Expected: `taxonomy.test.ts` #10만 FAIL — 코드에 아직 `track("balance_answered"…)` 등이 있고 `question_answered` 등이 없다(다음 단계에서 화면이 고친다). 나머지 PASS. #6·#7·#9·#11이 실패하면 문서(md/csv)와 `schema.ts` 중 틀린 쪽을 찾아 고친다.

- [ ] **Step 7: state.ts (리듀서) — 테스트 먼저**

`web/src/lib/flow/state.test.ts`를 통째로 바꾼다:
```ts
import { describe, expect, it } from "vitest";
import { SQL_PATH } from "@/lib/paths/__fixtures__/paths";
import { INITIAL, curiousPicks, flowReducer, type DrawView, type FlowAction, type FlowState } from "./state";

const art = { animal: "cat", bg: "peach", sky: "moon", ground: "none", rare: false } as const;
const view = (n: number): DrawView => ({
  picks: Array.from({ length: n }, (_, i) => ({
    card: { id: `b${i}`, entry: "target" as const, title: `책 ${i}`, author: `저자 ${i}`, genre: "데이터 분석", field: "데이터·통계", oneLiner: "한 줄", oneLinerStyle: "summary" as const },
    kind: i === 0 ? ("random" as const) : ("recommended" as const),
    art,
    reason: { label: "나온 이유" as const, items: ["데이터 분석"] },
  })),
  exhausted: false,
  path: { crumbs: ["뭔가 배우기"], moods: [], mode: "normal" },
});
const run = (actions: FlowAction[], from: FlowState = INITIAL) => actions.reduce(flowReducer, from);
const answers = (path = SQL_PATH): FlowAction[] => path.map((a) => ({ type: "answer" as const, choice: a.choice }));
const asked = () => run([{ type: "start" }, ...answers()]);
const opened = () => run([{ type: "drawn", id: 1, draw: view(5) }, { type: "open" }], asked());

describe("flowReducer (v2 questions)", () => {
  it("starts the questions and keeps what this session has already shown", () => {
    expect(run([{ type: "start" }], { ...INITIAL, seen: ["x"], index: 3 })).toEqual({ ...INITIAL, step: "questions", seen: ["x"] });
  });

  it("records each answer against the question on screen and counts every answer given", () => {
    const s = run([{ type: "start" }, ...answers().slice(0, 3)]);
    expect(s).toMatchObject({ step: "questions", asked: 3, status: "idle", drawId: 0 });
    expect(s.answers).toEqual(SQL_PATH.slice(0, 3));
  });

  it("asks for a draw once the path ends, then takes no more answers", () => {
    const s = asked();
    expect(s).toMatchObject({ step: "book", status: "loading", drawId: 1, draw: null, asked: 11, drawnFor: SQL_PATH });
    expect(flowReducer(s, { type: "answer", choice: "A" })).toBe(s);
    expect(flowReducer(INITIAL, { type: "answer", choice: "A" })).toBe(INITIAL);
  });

  it("back on a question drops the last answer; on the first question or elsewhere it changes nothing", () => {
    const back = run([{ type: "start" }, ...answers().slice(0, 2), { type: "back" }]);
    expect(back).toMatchObject({ step: "questions", asked: 2 });
    expect(back.answers).toEqual(SQL_PATH.slice(0, 1));
    const first = run([{ type: "start" }]);
    expect(flowReducer(first, { type: "back" })).toBe(first);
    expect(flowReducer(asked(), { type: "back" })).toEqual(asked());     // S-03: no back
  });

  describe("S-04 [← 질문으로 돌아가기]", () => {
    it("goes back to the last question with the book kept open", () => {
      const s = flowReducer(opened(), { type: "back" });
      expect(s).toMatchObject({ step: "questions", opened: true, status: "ready" });
      expect(s.answers).toEqual(SQL_PATH.slice(0, -1));
    });

    it("the same answer again: straight back to the first page with the same five books", () => {
      const before = opened();
      const s = run([{ type: "back" }, { type: "answer", choice: "A" }], before);
      expect(s).toMatchObject({ step: "first", drawId: 1, status: "ready", asked: 12 });
      expect(s.draw).toBe(before.draw);
    });

    it("another answer: a new draw on the open book", () => {
      const s = run([{ type: "back" }, { type: "answer", choice: "B" }], opened());
      expect(s).toMatchObject({ step: "first", status: "loading", drawId: 2, draw: null });
      expect(s.drawnFor?.at(-1)).toEqual({ node: "learn-len", choice: "B" });
    });

    it("the same answer after a failed draw asks again", () => {
      const s = run([{ type: "drawFailed", id: 1 }, { type: "open" }, { type: "back" }, { type: "answer", choice: "A" }], asked());
      expect(s).toMatchObject({ step: "first", status: "loading", drawId: 2 });
    });
  });

  it("ignores a late answer to an older draw and retries a failed one", () => {
    const s = asked();
    expect(flowReducer(s, { type: "drawn", id: 0, draw: view(5) })).toBe(s);
    expect(flowReducer(s, { type: "drawFailed", id: 0 })).toBe(s);
    const failed = flowReducer(s, { type: "drawFailed", id: 1 });
    expect(failed).toMatchObject({ status: "error" });
    expect(flowReducer(failed, { type: "retry" })).toMatchObject({ status: "loading", drawId: 2 });
    expect(flowReducer(s, { type: "retry" })).toBe(s);
  });

  it("opens the book only from S-03, then pages through the bookmarks, marking each as seen", () => {
    expect(flowReducer(INITIAL, { type: "open" })).toBe(INITIAL);
    const first = opened();
    expect(first).toMatchObject({ step: "first", opened: true });
    const marks = flowReducer(first, { type: "next" });
    expect(marks).toMatchObject({ step: "bookmarks", index: 0, seen: ["b0"] });
    const two = flowReducer(marks, { type: "react", reaction: "curious" });
    expect(two).toMatchObject({ index: 1, reactions: ["curious"], seen: ["b0", "b1"] });
  });

  it("waits for the draw before the next page", () => {
    const loading = run([{ type: "open" }], asked());
    expect(flowReducer(loading, { type: "next" })).toBe(loading);
  });

  it("S-06 after a 궁금해요, S-08 after none; ‹ › within the 궁금해요 books", () => {
    const all = (r: "pass" | "curious"): FlowAction[] => Array.from({ length: 5 }, () => ({ type: "react" as const, reaction: r }));
    const marks = flowReducer(opened(), { type: "next" });
    expect(run(all("pass"), marks)).toMatchObject({ step: "end" });
    const mixed = run([{ type: "react", reaction: "curious" }, ...all("pass").slice(0, 2), { type: "react", reaction: "curious" }, { type: "react", reaction: "pass" }], marks);
    expect(mixed).toMatchObject({ step: "result", result: 0 });
    expect(curiousPicks(mixed).map((p) => p.card.id)).toEqual(["b0", "b3"]);
    expect(flowReducer(mixed, { type: "prevResult" })).toBe(mixed);
    const second = flowReducer(mixed, { type: "nextResult" });
    expect(second).toMatchObject({ result: 1 });
    expect(flowReducer(second, { type: "prevResult" })).toMatchObject({ result: 0 });
    expect(flowReducer(second, { type: "nextResult" })).toMatchObject({ step: "end" });
  });

  it("[다시 뽑기]: the same answers, a new closed book, nothing carried over", () => {
    const end = run(Array.from({ length: 5 }, () => ({ type: "react" as const, reaction: "pass" as const })), flowReducer(opened(), { type: "next" }));
    const again = flowReducer(end, { type: "redraw" });
    expect(again).toMatchObject({ step: "book", opened: false, status: "loading", drawId: 2, index: 0, reactions: [], result: 0 });
    expect(again.answers).toEqual(SQL_PATH);
    expect(flowReducer(opened(), { type: "redraw" })).toEqual(opened());
  });

  it("[처음으로] keeps only the books already shown", () => {
    const marks = flowReducer(opened(), { type: "next" });
    expect(flowReducer(marks, { type: "home" })).toEqual({ ...INITIAL, seen: ["b0"] });
  });
});
```

Run: `npx vitest run src/lib/flow/state.test.ts`
Expected: FAIL (옛 리듀서).

`web/src/lib/flow/state.ts`를 통째로 바꾼다:
```ts
import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import type { Answer, AnswerChoice, PathSummary } from "@/lib/paths";
import type { Reason } from "@/lib/recommend";
import { nextQuestion, sameAnswers } from "./path";

export type Step = "home" | "questions" | "book" | "first" | "bookmarks" | "result" | "end";
export const STEPS: readonly Step[] = ["home", "questions", "book", "first", "bookmarks", "result", "end"];
export type Reaction = "pass" | "curious";
export interface PickView { card: BookCard; kind: "recommended" | "random"; art: ArtCombo; reason: Reason }
export interface DrawView { picks: PickView[]; exhausted: boolean; path: PathSummary }
export type DrawStatus = "idle" | "loading" | "ready" | "error";

export interface FlowState {
  step: Step;
  answers: Answer[];               // the path so far — going back drops the last one
  asked: number;                   // answers given in this round, re-answers after going back included (E-32 position)
  drawnFor: Answer[] | null;       // the answers the current draw was asked for (S-04 back + the same answer = the same books)
  status: DrawStatus;
  drawId: number;                  // +1 for every draw request; late answers to older requests are ignored
  draw: DrawView | null;
  opened: boolean;
  index: number;                   // current bookmark (0-based)
  reactions: Reaction[];
  result: number;                  // S-06: which 궁금해요 book is shown (0-based)
  seen: string[];                  // books shown in this session — excluded from later draws (F-05)
}

export const INITIAL: FlowState = {
  step: "home", answers: [], asked: 0, drawnFor: null,
  status: "idle", drawId: 0, draw: null, opened: false, index: 0, reactions: [], result: 0, seen: [],
};

export type FlowAction =
  | { type: "start" }
  | { type: "answer"; choice: AnswerChoice }
  | { type: "back" }
  | { type: "drawn"; id: number; draw: DrawView }
  | { type: "drawFailed"; id: number }
  | { type: "retry" }
  | { type: "open" }
  | { type: "next" }
  | { type: "react"; reaction: Reaction }
  | { type: "nextResult" }
  | { type: "prevResult" }
  | { type: "redraw" }
  | { type: "home" };

/** Ask for a new draw for the current answers: to S-03 the first time, straight back to the open book after S-04 back. */
function requestDraw(s: FlowState): FlowState {
  return { ...s, status: "loading", drawId: s.drawId + 1, draw: null, drawnFor: s.answers, step: s.opened ? "first" : "book" };
}

/** The 궁금해요 books of this round, in bookmark order — S-06 shows them one by one. */
export function curiousPicks(s: Pick<FlowState, "draw" | "reactions">): PickView[] {
  return (s.draw?.picks ?? []).filter((_, i) => s.reactions[i] === "curious");
}

const addSeen = (seen: string[], id: string) => (seen.includes(id) ? seen : [...seen, id]);

function answer(s: FlowState, choice: AnswerChoice): FlowState {
  if (s.step !== "questions") return s;
  const node = nextQuestion(s.answers);
  if (!node) return s;
  const answers = [...s.answers, { node: node.id, choice }];
  const moved = { ...s, answers, asked: s.asked + 1 };
  if (nextQuestion(answers) !== null) return moved;
  // the path is done. Back on the open book with the same answers (and a draw that did not fail): the same five books.
  if (s.opened && s.drawnFor && sameAnswers(answers, s.drawnFor) && s.status !== "error") return { ...moved, step: "first" };
  return requestDraw(moved);
}

export function flowReducer(s: FlowState, a: FlowAction): FlowState {
  switch (a.type) {
    case "start":
      return { ...INITIAL, seen: s.seen, step: "questions" };
    case "answer":
      return answer(s, a.choice);
    case "back":
      // S-02 [← 이전 질문] and S-04 [← 질문으로 돌아가기] drop the last answer. The first question's back is Flow's [처음으로].
      if ((s.step === "questions" || s.step === "first") && s.answers.length > 0) {
        return { ...s, step: "questions", answers: s.answers.slice(0, -1) };
      }
      return s;
    case "drawn":
      return s.status === "loading" && a.id === s.drawId ? { ...s, status: "ready", draw: a.draw } : s;
    case "drawFailed":
      return s.status === "loading" && a.id === s.drawId ? { ...s, status: "error" } : s;
    case "retry":
      return s.status === "error" ? { ...s, status: "loading", drawId: s.drawId + 1 } : s;
    case "open":
      return s.step === "book" ? { ...s, opened: true, step: "first" } : s;
    case "next":
      if (s.step !== "first" || s.status !== "ready" || !s.draw || s.draw.picks.length === 0) return s;
      return { ...s, step: "bookmarks", index: 0, reactions: [], seen: addSeen(s.seen, s.draw.picks[0].card.id) };
    case "react": {
      if (s.step !== "bookmarks" || !s.draw) return s;
      const reactions = [...s.reactions, a.reaction];
      const index = s.index + 1;
      if (index >= s.draw.picks.length) {
        // PRD 2절: S-06 when something was 궁금해요, straight to S-08 when nothing was
        return { ...s, reactions, result: 0, step: reactions.includes("curious") ? "result" : "end" };
      }
      return { ...s, reactions, index, seen: addSeen(s.seen, s.draw.picks[index].card.id) };
    }
    case "nextResult": {
      if (s.step !== "result") return s;
      const result = s.result + 1;
      return result < curiousPicks(s).length ? { ...s, result } : { ...s, step: "end" };
    }
    case "prevResult":
      return s.step === "result" && s.result > 0 ? { ...s, result: s.result - 1 } : s;
    case "redraw":
      // F-10: the same answers, five new books (seen stay excluded), the earlier 궁금해요 do not carry over; a new closed book.
      if (s.step !== "end") return s;
      return requestDraw({ ...s, opened: false, index: 0, reactions: [], result: 0 });
    case "home":
      return { ...INITIAL, seen: s.seen };
  }
}
```

Run: `npx vitest run src/lib/flow/state.test.ts`
Expected: PASS.

- [ ] **Step 8: storage.ts v6 · api.ts**

`web/src/lib/flow/storage.ts`:
1. import `QUESTIONS` 줄 → `import { isPath } from "./path";`. import `{ nextRound, setEntry }` → `{ nextRound, setEntry, setMode }`.
2. VERSION:
```ts
const VERSION = 6;   // 2 (P4): picks carry their reason, S-06 keeps its place; 3: 마음·회복 left the keyword list; 4 (F-24): goals carry
                     // `missing`; 5 (10-02): 🍃 questions in a shuffled order; 6 (v2, 10-04): one entry and the question map's
                     // `answers` — any older saved flow starts over
```
3. `isOrder` 함수를 지우고 `readSaved`의 `if (!isOrder(state.order)) return null;` 줄을 `if (!isPath(state.answers)) return null;   // answers off today's map (the map was edited): start over` 로.
4. `restoreFlow`의 `setEntry(null);` 아래에 `setMode(null);`.

`web/src/lib/flow/storage.test.ts`:
- import에 `import { SQL_PATH } from "@/lib/paths/__fixtures__/paths";`.
- `"round-trips the state in this tab"`의 `s` → `const s: FlowState = { ...INITIAL, step: "questions", answers: SQL_PATH.slice(0, 3), asked: 3 };`
- `"turns a request cut off by a reload into a retry"`의 `saveFlow({ ...INITIAL, step: "book", entry: "leaf", status: "loading", drawId: 1 })` → `saveFlow({ ...INITIAL, step: "book", answers: SQL_PATH, status: "loading", drawId: 1 })`.
- `starts over on %s` 표 전체:
```ts
  it.each([
    ["nothing saved", null],
    ["broken JSON", "{"],
    ["another version", JSON.stringify({ v: 0, state: { ...INITIAL, step: "questions" } })],
    ["a version-5 flow (9 balance questions, 🎯 form)", JSON.stringify({ v: 5, state: { ...INITIAL, step: "leaf", entry: "leaf", choices: ["A"], order: [0, 1, 2, 3, 4, 5, 6, 7, 8] } })],
    ["an unknown step", JSON.stringify({ v: 6, state: { ...INITIAL, step: "shelf" } })],
    ["answers off the map", JSON.stringify({ v: 6, state: { ...INITIAL, step: "questions", answers: [{ node: "branch", choice: "A" }] } })],
    ["answers that are not a list", JSON.stringify({ v: 6, state: { ...INITIAL, step: "questions", answers: "start" } })],
  ])("starts over on %s", (_, raw) => {
```
- 나머지 고정값: `entry: "leaf", choices: ["A", "B"]` → `answers: SQL_PATH.slice(0, 2)`; `entry: "leaf"`·`entry: "target"`만 있는 곳 → `answers: SQL_PATH` (그 테스트가 `step: "end"`·`"bookmarks"`일 때) 또는 지움(`step: "home"`일 때); `step: "leaf"` → `step: "questions"`. `"clears the entry chosen in the abandoned round …"` 테스트에 `setMode("challenge");`를 `setEntry("leaf");` 다음에 넣고 마지막 expect 아래에 `expect(commonProps().mode).toBeNull();`(import에 `setMode`). `"settleOpen decides first …"`의 `toMatchObject({ round: before + 1, entry: null })` → `({ round: before + 1, entry: null, mode: null })`.

`web/src/lib/flow/api.ts`를 통째로 바꾼다:
```ts
import { artsForDraw } from "@/lib/art/combine";
import type { PathDrawResponse } from "@/lib/books/types";
import type { DrawView, FlowState } from "./state";

/** Body for POST /api/books/draw (checked strictly on the server — a finished path of the question map). */
export function drawBody(s: Pick<FlowState, "answers" | "seen">): Record<string, unknown> {
  return { answers: s.answers, seen: s.seen };
}

export async function requestDraw(body: Record<string, unknown>): Promise<PathDrawResponse> {
  const res = await fetch("/api/books/draw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`draw failed: ${res.status}`);
  return (await res.json()) as PathDrawResponse;
}

/** Pictures are drawn in the browser, once per draw (PRD F-08: random each time; P5 saves the combo). */
export function toDrawView(res: PathDrawResponse, artSeed: number): DrawView {
  const arts = artsForDraw(res.picks.length, artSeed);
  return {
    picks: res.picks.map((p, i) => ({ card: p.card, kind: p.kind, art: arts[i], reason: p.reason })),
    exhausted: res.exhausted,
    path: res.path,
  };
}
```

`web/src/lib/flow/api.test.ts`를 통째로 바꾼다:
```ts
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PathDrawResponse } from "@/lib/books/types";
import { SQL_PATH } from "@/lib/paths/__fixtures__/paths";
import { drawBody, requestDraw, toDrawView } from "./api";
import { INITIAL } from "./state";

const card = (id: string) => ({ id, entry: "leaf" as const, title: id, author: "시인", genre: "시", field: null, oneLiner: "?", oneLinerStyle: "question" as const });
const RES: PathDrawResponse = {
  picks: ["a", "b", "c", "d", "e"].map((id, i) => ({
    card: card(id), kind: i === 0 ? "random" : "recommended", reason: { label: "나온 이유", items: [`이유 ${id}`] },
  })),
  exhausted: false, widened: false, path: { crumbs: ["이야기에 빠지기"], moods: [], mode: "challenge" },
};

describe("flow api", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the answers and the books this session has shown", () => {
    expect(drawBody({ ...INITIAL, answers: SQL_PATH, seen: ["x"] })).toEqual({ answers: SQL_PATH, seen: ["x"] });
  });

  it("gives every pick its own animal, keeps the order and the path for S-04", () => {
    const view = toDrawView(RES, 9);
    expect(view.picks.map((p) => p.card.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(view.picks.map((p) => p.kind)).toEqual(["random", "recommended", "recommended", "recommended", "recommended"]);
    expect(new Set(view.picks.map((p) => p.art.animal)).size).toBe(5);
    expect(view.picks[1].reason).toEqual({ label: "나온 이유", items: ["이유 b"] });
    expect(view.path).toEqual(RES.path);
  });

  it("posts JSON to /api/books/draw", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(RES));
    vi.stubGlobal("fetch", fetchMock);
    expect(await requestDraw({ answers: [] })).toEqual(RES);
    expect(fetchMock).toHaveBeenCalledWith("/api/books/draw", expect.objectContaining({ method: "POST", body: "{\"answers\":[]}" }));
  });

  it("throws on a failed request so the page can offer a retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 400 })));
    await expect(requestDraw({})).rejects.toThrow(/400/);
  });
});
```

- [ ] **Step 9: Home · FirstPage · FlowRoot · page**

먼저 읽기: `web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`.

`web/src/components/flow/Home.tsx` — `Entry` import와 `ENTRIES` 상수를 지우고 Props·입구를 바꾼다:
```tsx
/** library: F-23 count from the server (page.tsx), null until the first fill — then the cover keeps the logo. */
interface Props { onStart: () => void; library?: LibraryCount | null }

/** PRD F-01 v2 wording (design 10절). */
export const START_LABEL = "갈피 잡으러 가기";
export const START_NOTE = "질문 몇 개면 한 권을 만나요";
```
`<div className={styles.entries}>…</div>` 블록을:
```tsx
      <div className={styles.entries}>
        <button type="button" className={styles.entry} onClick={onStart}>
          <span className={styles.entryTitle}>{START_LABEL}</span>
          <span className={styles.go}><Arrow /></span>
        </button>
        <p className={styles.entryNote}>{START_NOTE}</p>
      </div>
```
`Home.module.css`: `.entryText`·`.entryDesc` 줄을 지우고 `.entryTitle` 아래에 `.entryNote { margin: 0; font-size: 13px; color: var(--ink-muted); text-align: center; }`.

`web/src/components/flow/Home.test.tsx`의 처음 두 테스트를 바꾼다:
```tsx
  it("offers one entry with the v2 wording and the line under it (PRD F-01, design 10절)", () => {
    const onStart = vi.fn();
    render(<Home onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: "갈피 잡으러 가기" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(screen.getByText("질문 몇 개면 한 권을 만나요")).toBeInTheDocument();
  });

  it("has no login place of its own — the one entry, then the 갈피 우체통 last (F-26)", () => {
    render(<Home onStart={vi.fn()} />);
    expect(screen.queryByTestId("account-slot")).toBeNull();
    expect(screen.queryByText("로그인")).toBeNull();
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent)).toEqual([
      "갈피 잡으러 가기",
      "갈피 우체통 — 써 보고 느낀 점을 넣어 주세요",
    ]);
    expect(screen.getByRole("heading", { name: "갈피" })).toBeInTheDocument();
    expect(screen.getByText("읽을 책, 갈피가 안 잡힐 때")).toBeInTheDocument();
  });
```
그리고 `expect(screen.getAllByRole("button")).toHaveLength(3);   // two entries + 갈피 우체통` → `toHaveLength(2);   // one entry + 갈피 우체통`.

`web/src/components/flow/FirstPage.tsx`를 통째로 바꾼다:
```tsx
import { LogoMark } from "@/components/Logo";
import styles from "./FirstPage.module.css";

/** S-04 left page (inside of the cover): the chapter title, like a book's first page (DESIGN C-10 v2). */
export function FirstPageTitle() {
  return (
    <div className={styles.titlePage}>
      <LogoMark className={styles.ornament} width={32} />
      <h2 className={styles.title}>당신이 고른 길</h2>
    </div>
  );
}
```
`FirstPage.module.css`에서 `.caption` 두 줄(기본과 `@media` 안)을 지운다. `.rows`·`.row`·`.note`·`.dots`는 그대로 둔다(`.dots`가 쓰이지 않으면 지운다 — `grep -n "dots" web/src/components/flow/*.tsx`가 빈 출력이면).

`web/src/components/flow/FlowRoot.tsx`:
```tsx
"use client";
import { useSyncExternalStore } from "react";
import type { LibraryCount } from "@/lib/books/library";
import { Flow } from "./Flow";
import { Home } from "./Home";

const subscribe = () => () => {};
const noop = () => {};

/**
 * Server HTML (and the hydration pass) is S-01; the browser then resumes the saved flow without a mismatch.
 * library: the F-23 count, from the server (null until the first fill).
 */
export function FlowRoot({ library = null }: { library?: LibraryCount | null }) {
  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false);
  return inBrowser ? <Flow library={library} /> : <Home onStart={noop} library={library} />;
}
```
`web/src/components/flow/FlowRoot.test.tsx`에서 `vocab={…}` 속성을 지운다.

`web/src/app/page.tsx`: `import { ACTIVE_VOCAB, library } from "@/lib/books/catalog";` → `import { library } from "@/lib/books/catalog";`, `<FlowRoot vocab={ACTIVE_VOCAB} library={…} />` → `<FlowRoot library={library(new Date())} />`.

- [ ] **Step 10: BookScene**

`web/src/components/flow/BookScene.tsx`를 통째로 바꾼다:
```tsx
"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { Bookmark } from "@/components/Bookmark";
import { Button } from "@/components/Button";
import type { FlowState, Reaction } from "@/lib/flow/state";
import { hasSeenFirstGuide, markFirstGuideSeen } from "@/lib/flow/firstGuide";
import { BOOKMARK_AWAY, BOOKMARK_DOWN, BOOKMARK_RISE } from "@/lib/motion";
import { EXHAUSTED_NOTICE } from "@/lib/recommend";
import { Book, RuledPage } from "./Book";
import { CoverPeeks } from "./CoverPeeks";
import { FirstGuide } from "./FirstGuide";
import { FirstPageTitle } from "./FirstPage";
import { PathPage } from "./PathPage";
import styles from "./BookScene.module.css";

/** No wording in the docs for a failed draw request — new copy, logged in context.md. */
export const DRAW_FAILED = "책을 불러오지 못했어요";
/** S-04 (design 10절): back to the last question; the same answer keeps these five books, another draws anew. */
export const BACK_TO_QUESTIONS = "질문으로 돌아가기";

/** T-06: rise with a bounce; 궁금해요 flies up with a tilt; 패스 drops down. */
const BOOKMARK: Variants = {
  hidden: { y: 120, opacity: 0, rotate: 0 },
  shown: { y: 0, opacity: 1, rotate: 0, transition: BOOKMARK_RISE },
  gone: (reaction: Reaction) => (reaction === "curious"
    ? { y: -180, rotate: -8, opacity: 0, transition: BOOKMARK_AWAY }
    : { y: 180, opacity: 0, transition: BOOKMARK_DOWN }),
};

interface Props {
  state: FlowState;
  onOpen: () => void;
  /** S-04 [← 질문으로 돌아가기] (E-33 source=first_page) */
  onBack: () => void;
  onNext: () => void;
  onRetry: () => void;
  onReact: (reaction: Reaction) => void;
  onHome: () => void;
}

/**
 * S-03 · S-04 · S-05 share one book so the cover keeps its place between steps. The book fills the column; the bookmark
 * rises out of the gutter, centred between the two pages. Buttons sit below the book; the page count is the folio.
 */
export function BookScene({ state, onOpen, onBack, onNext, onRetry, onReact, onHome }: Props) {
  const [busy, setBusy] = useState(true);            // a bookmark is still moving: reactions wait (and frost stays off)
  const [last, setLast] = useState<Reaction>("pass");
  // C-20: the first bookmark of a browser's first round explains itself once (logged in or not)
  const [guide, setGuide] = useState(() => !hasSeenFirstGuide());
  const scene = useRef<HTMLDivElement>(null);
  const closeGuide = () => {
    markFirstGuideSeen();
    setGuide(false);
  };
  const { step, status, draw } = state;
  const picks = draw?.picks ?? [];
  const pick = step === "bookmarks" ? picks[state.index] : undefined;
  const noBooks = status === "ready" && picks.length === 0;

  const react = (reaction: Reaction) => {
    if (busy) return;
    setBusy(true);
    setLast(reaction);
    onReact(reaction);
  };

  const left = step === "first" && state.opened ? <FirstPageTitle /> : <RuledPage />;
  const right = step === "bookmarks"
    ? <RuledPage turn={state.index} />
    : state.opened && <PathPage summary={draw?.path ?? null} notices={noBooks ? [EXHAUSTED_NOTICE] : []} />;

  // C-19: five decorative bookmark tips stand out of the closed book (nothing from the draw — no wait, no hint).
  const tucked = step === "book" || step === "first" ? <CoverPeeks open={state.opened} /> : null;

  return (
    <div ref={scene} className={styles.scene} data-wide-scene="" data-peeks={step === "book" ? "" : undefined} data-clip={tucked ? "" : undefined}>
      <div className={styles.stage}>
        <Book open={state.opened} onPress={step === "book" ? onOpen : undefined} left={left} right={right} tucked={tucked} />
        {pick && <p className={styles.folio}>{`${state.index + 1} / ${picks.length}`}</p>}
        {pick && (
          <div className={styles.slot}>
            <AnimatePresence mode="wait" custom={last}>
              <motion.div
                key={pick.card.id}
                custom={last}
                variants={BOOKMARK}
                initial="hidden"
                animate="shown"
                exit="gone"
                onAnimationComplete={(definition) => { if (definition === "shown") setBusy(false); }}
              >
                <div className={styles.scaled}><Bookmark card={pick.card} art={pick.art} moving={busy} /></div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* the words moved onto the cover (C-01 tap cue, 10-02); this keeps the room the layout math counts on */}
      {step === "book" && <p className={styles.hint} aria-hidden="true" />}

      {step === "first" && (
        <div className={styles.actions}>
          {status === "error" && <p className={styles.error} role="alert">{DRAW_FAILED}</p>}
          {status === "error" ? (
            <>
              <Button variant="secondary" onClick={onHome}>처음으로</Button>
              <Button onClick={onRetry}>다시 시도</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={onBack}><span aria-hidden="true">← </span>{BACK_TO_QUESTIONS}</Button>
              {noBooks
                ? <Button onClick={onHome}>처음으로</Button>
                : <Button onClick={onNext} disabled={status !== "ready"}>다음 장</Button>}
            </>
          )}
        </div>
      )}

      {step === "bookmarks" && pick && (
        <div className={styles.actions} data-part="reactions">
          <Button variant="secondary" disabled={busy} onClick={() => react("pass")}>패스</Button>
          <Button disabled={busy} onClick={() => react("curious")}>궁금해요</Button>
        </div>
      )}

      {step === "bookmarks" && pick && state.index === 0 && !busy && guide && <FirstGuide scope={scene} onDone={closeGuide} />}
    </div>
  );
}
```

`web/src/components/flow/BookScene.test.tsx`를 통째로 바꾼다:
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EXHAUSTED_NOTICE } from "@/lib/recommend";
import { SQL_PATH } from "@/lib/paths/__fixtures__/paths";
import { INITIAL, type DrawView, type FlowState } from "@/lib/flow/state";
import { BookScene, DRAW_FAILED } from "./BookScene";

const art = { animal: "owl", bg: "sky", sky: "cloud", ground: "grass", rare: false } as const;
const view = (n: number, mode: "normal" | "challenge" = "normal"): DrawView => ({
  picks: Array.from({ length: n }, (_, i) => ({
    card: { id: `b${i}`, entry: "target" as const, title: `책 ${i}`, author: `저자 ${i}`, genre: "통계", field: "데이터·통계", oneLiner: `한 줄 ${i}`, oneLinerStyle: "summary" as const },
    kind: "recommended" as const,
    art,
    reason: { label: "나온 이유" as const, items: ["통계"] },
  })),
  exhausted: false,
  path: { crumbs: ["뭔가 배우기", "DB에서 꺼내기"], moods: ["가볍게 한 권"], mode },
});
const first: FlowState = { ...INITIAL, step: "first", answers: SQL_PATH, drawnFor: SQL_PATH, opened: true, status: "ready", drawId: 1, draw: view(5) };
const handlers = () => ({ onOpen: vi.fn(), onBack: vi.fn(), onNext: vi.fn(), onRetry: vi.fn(), onReact: vi.fn(), onHome: vi.fn() });

describe("BookScene", () => {
  it("S-03: the closed book is the thing to press", () => {
    const h = handlers();
    render(<BookScene state={{ ...first, step: "book", opened: false, status: "loading", draw: null }} {...h} />);
    expect(screen.getByText("눌러서 펼치기")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "당신이 고른 길" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "책 펼치기" }));
    expect(h.onOpen).toHaveBeenCalledTimes(1);
  });

  describe("C-19: five bookmark tips tucked into the closed book", () => {
    const tips = (c: HTMLElement) => c.querySelectorAll("[data-tip]");
    const layers = (c: HTMLElement) => [...c.querySelectorAll("[data-cover-peeks]")];
    const closed = (over: Partial<FlowState>): FlowState => ({ ...first, step: "book", opened: false, ...over });

    it.each([
      ["loading", closed({ status: "loading", draw: null })],
      ["failed", closed({ status: "error", draw: null })],
      ["ready", closed({})],
    ])("five tips, hidden from assistive tech, whatever the draw (%s)", (_, state) => {
      const { container } = render(<BookScene state={state} {...handlers()} />);
      expect(tips(container)).toHaveLength(5);
      expect(layers(container).length).toBeGreaterThan(0);
      for (const layer of layers(container)) {
        expect(layer).toHaveAttribute("aria-hidden", "true");
        expect(layer).not.toHaveAttribute("data-open");
      }
      expect(screen.getByRole("button", { name: "책 펼치기" })).toBeEnabled();
    });

    it("shows nothing of the draw: no titles, no art", () => {
      const { container } = render(<BookScene state={closed({})} {...handlers()} />);
      const html = layers(container).map((l) => l.outerHTML).join("");
      expect(html).not.toContain("책 0");
      expect(html).not.toContain("/animals/");
      expect(container.querySelectorAll("[data-cover-peeks] article")).toHaveLength(0);
    });

    it("fade out once the book is open (S-04), and are gone from S-05 on", () => {
      const { container, rerender } = render(<BookScene state={first} {...handlers()} />);
      for (const layer of layers(container)) expect(layer).toHaveAttribute("data-open", "");
      rerender(<BookScene state={{ ...first, step: "bookmarks", index: 0 }} {...handlers()} />);
      expect(layers(container)).toHaveLength(0);
    });
  });

  it("S-04: the title page faces 당신이 고른 길 — the path and the mood, no book count", () => {
    const { container } = render(<BookScene state={first} {...handlers()} />);
    const heading = screen.getByRole("heading", { name: "당신이 고른 길" });
    const way = screen.getByRole("region", { name: "지나온 길" });
    expect(way).toHaveTextContent("뭔가 배우기DB에서 꺼내기");
    expect(screen.getByRole("region", { name: "기분" })).toHaveTextContent("가볍게 한 권");
    expect(way.parentElement?.contains(heading)).toBe(false);
    expect(container).not.toHaveTextContent(/\d+권/);
    expect(screen.queryByText("평소의 당신과 반대편에서 골랐어요")).toBeNull();
  });

  it("S-04: the challenge route says so in one line", () => {
    render(<BookScene state={{ ...first, draw: view(5, "challenge") }} {...handlers()} />);
    expect(screen.getByText("평소의 당신과 반대편에서 골랐어요")).toBeInTheDocument();
  });

  it("S-04: [← 질문으로 돌아가기] (secondary) and [다음 장] (the one primary) below the book", () => {
    const h = handlers();
    render(<BookScene state={first} {...h} />);
    const back = screen.getByRole("button", { name: "질문으로 돌아가기" });
    expect(back).toHaveTextContent("← 질문으로 돌아가기");
    expect(back).toHaveAttribute("data-variant", "secondary");
    expect(screen.getByRole("button", { name: "다음 장" })).toHaveAttribute("data-variant", "primary");
    fireEvent.click(back);
    fireEvent.click(screen.getByRole("button", { name: "다음 장" }));
    expect(h.onBack).toHaveBeenCalledTimes(1);
    expect(h.onNext).toHaveBeenCalledTimes(1);
  });

  it("S-04: waits for the draw — no path yet, 다음 장 off, the way back stays", () => {
    render(<BookScene state={{ ...first, status: "loading", draw: null }} {...handlers()} />);
    expect(screen.getByRole("button", { name: "다음 장" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "질문으로 돌아가기" })).toBeEnabled();
    expect(screen.queryByRole("region", { name: "지나온 길" })).toBeNull();
  });

  it("S-04: a failed draw offers a primary retry and a way home, and no dead 다음 장", () => {
    const h = handlers();
    render(<BookScene state={{ ...first, status: "error", draw: null }} {...h} />);
    expect(screen.getByRole("alert")).toHaveTextContent(DRAW_FAILED);
    expect(screen.getByRole("button", { name: "다시 시도" })).toHaveAttribute("data-variant", "primary");
    expect(screen.getByRole("button", { name: "처음으로" })).toHaveAttribute("data-variant", "secondary");
    expect(screen.queryByRole("button", { name: "다음 장" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    fireEvent.click(screen.getByRole("button", { name: "처음으로" }));
    expect(h.onRetry).toHaveBeenCalledTimes(1);
    expect(h.onHome).toHaveBeenCalledTimes(1);
  });

  it("S-04: sends the person home when the draw is empty", () => {
    const h = handlers();
    render(<BookScene state={{ ...first, draw: view(0) }} {...h} />);
    expect(screen.getByText(EXHAUSTED_NOTICE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다음 장" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "처음으로" }));
    expect(h.onHome).toHaveBeenCalledTimes(1);
  });

  it("S-05: the bookmark sits on the book, pass / curious below, with the count of a short draw", () => {
    render(<BookScene state={{ ...first, step: "bookmarks", index: 1, draw: view(3) }} {...handlers()} />);
    expect(screen.getByRole("article", { name: "책 1, 저자 1, 한 줄 1, 통계" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "패스" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "궁금해요" })).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });
});
```

- [ ] **Step 11: Flow.tsx**

`web/src/components/flow/Flow.tsx`를 통째로 바꾼다:
```tsx
"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import { MotionConfig } from "motion/react";
import { newArtSeed } from "@/lib/art/combine";
import { readyCover, waitForCover } from "@/lib/books/detailClient";
import type { LibraryCount } from "@/lib/books/library";
import { drawBody, requestDraw, toDrawView } from "@/lib/flow/api";
import { completedProps, nextQuestion, pathCommon } from "@/lib/flow/path";
import { curiousPicks, flowReducer, type FlowAction, type FlowState, type Reaction } from "@/lib/flow/state";
import { loadFlow, saveFlow } from "@/lib/flow/storage";
import type { Answer, AnswerChoice } from "@/lib/paths";
import { setEntry, setMode } from "@/lib/track/common";
import { track } from "@/lib/track/client";
import { BookScene } from "./BookScene";
import { EndScreen } from "./EndScreen";
import { Home } from "./Home";
import { Question } from "./Question";
import { ResultBook } from "./ResultBook";
import { ResultLoading } from "./ResultLoading";

/** taxonomy v1.0 3-1: the common branch (`entry`) and route (`mode`) follow the answers — set after each answer or step back. */
function syncCommon(answers: readonly Answer[]) {
  const { entry, mode } = pathCommon(answers);
  setEntry(entry);
  setMode(mode);
}

/**
 * S-01 → S-02 (the question map) → S-03 … S-08. Cross-screen events are sent here, in the handlers (never from effects).
 * library: the F-23 count for S-01 (FlowRoot).
 */
export function Flow({ library = null }: { library?: LibraryCount | null }) {
  const [state, dispatch] = useReducer(flowReducer, undefined, loadFlow);
  const [shownResult, setShownResult] = useState<string | null>(null);   // the S-06 book whose cover is ready to show

  useEffect(() => { saveFlow(state); }, [state]);
  useEffect(() => { window.scrollTo(0, 0); }, [state.step, state.result, state.answers.length]);

  const runDraw = async (s: FlowState) => {
    try {
      const res = await requestDraw(drawBody(s));
      dispatch({ type: "drawn", id: s.drawId, draw: toDrawView(res, newArtSeed()) });
    } catch {
      dispatch({ type: "drawFailed", id: s.drawId });
    }
  };

  /** Apply an action; start a draw whenever the action asked for one. */
  const act = (action: FlowAction): FlowState => {
    const next = flowReducer(state, action);
    dispatch(action);
    if (next.drawId !== state.drawId) void runDraw(next);
    return next;
  };

  const trackShown = (s: FlowState) => {
    const pick = s.draw?.picks[s.index];
    if (!pick) return;
    track("bookmark_shown", {
      book_id: pick.card.id, position: s.index + 1, one_liner_style: pick.card.oneLinerStyle, pick_type: pick.kind, art: pick.art,
    });
  };

  /** E-10: the 궁금해요 book now on S-06 — once per book and round (taxonomy v0.11). */
  const viewedResults = useRef(new Set<string>());
  const trackResultBook = (s: FlowState) => {
    const pick = curiousPicks(s)[s.result];
    if (!pick || viewedResults.current.has(pick.card.id)) return;
    viewedResults.current.add(pick.card.id);
    track("result_book_viewed", { book_id: pick.card.id, position: s.result + 1, pick_type: pick.kind });
  };

  /** Into S-06: E-09 once, then E-10 for the first book; every 궁금해요 book's detail is asked for ahead. */
  const enterResult = (s: FlowState) => {
    const curious = curiousPicks(s);
    track("result_viewed", { curious_count: curious.length });
    viewedResults.current = new Set();
    trackResultBook(s);
    for (const p of curious) void readyCover(p.card.id);
  };

  /** S-01 [갈피 잡으러 가기] (E-02): no branch and no route yet — the questions set them. */
  const start = () => {
    syncCommon([]);
    track("entry_selected", { source: "home" });
    act({ type: "start" });
  };

  /** [처음으로] (E-20) — first_page = S-04 dead end, end = S-08, question = the first question's [← 이전 질문]. */
  const home = (source: "first_page" | "end" | "question") => {
    track("home_clicked", { curious_count: state.reactions.filter((r) => r === "curious").length, source });
    syncCommon([]);
    act({ type: "home" });
  };

  const node = state.step === "questions" ? nextQuestion(state.answers) : null;

  /** E-32 for every answer (common = before it), then E-34 when the path ends (common = the finished path). */
  const answer = (choice: AnswerChoice, elapsedMs: number) => {
    if (!node) return;
    track("question_answered", {
      node_id: node.id, kind: node.kind, choice, depth: state.answers.length + 1, position: state.asked + 1, elapsed_ms: elapsedMs,
    });
    const next = act({ type: "answer", choice });
    syncCommon(next.answers);
    if (nextQuestion(next.answers) === null) track("path_completed", completedProps(next.answers));
  };

  const holdCancelled = (heldMs: number) => {
    if (!node) return;
    track("unsure_hold_cancelled", { node_id: node.id, depth: state.answers.length + 1, held_ms: heldMs });
  };

  /** S-02 [← 이전 질문] and S-04 [← 질문으로 돌아가기] (E-33): drop the last answer. On the first question: S-01. */
  const back = () => {
    const last = state.answers.at(-1);
    if (!last) {
      home("question");
      return;
    }
    track("question_back_clicked", { node_id: last.node, depth: state.answers.length, source: state.step === "first" ? "first_page" : "question" });
    const next = act({ type: "back" });
    syncCommon(next.answers);
  };

  const open = () => {
    track("book_opened", {});
    act({ type: "open" });
  };

  const nextPage = () => {
    const next = act({ type: "next" });
    if (next.step === "bookmarks") trackShown(next);
  };

  const react = (reaction: Reaction) => {
    const pick = state.draw?.picks[state.index];
    if (state.step !== "bookmarks" || !pick) return;
    if (reaction === "curious") void readyCover(pick.card.id);       // its cover starts loading now (10-02)
    track("bookmark_reacted", {
      book_id: pick.card.id, position: state.index + 1, reaction, pick_type: pick.kind, one_liner_style: pick.card.oneLinerStyle,
    });
    const next = act({ type: "react", reaction });
    if (next.step === "bookmarks") trackShown(next);
    if (next.step === "result") enterResult(next);
  };

  const nextResult = () => {
    const next = act({ type: "nextResult" });
    if (next.step === "result") trackResultBook(next);
  };
  /** S-06 ‹: no event (taxonomy v0.11). */
  const prevResult = () => { act({ type: "prevResult" }); };

  /** S-08 [다시 뽑기] (E-19): track() moves the round on right after sending it (taxonomy 3-1a); the path stays. */
  const redraw = () => {
    track("redraw_clicked", { curious_count: state.reactions.filter((r) => r === "curious").length });
    act({ type: "redraw" });
  };

  const inBook = state.step === "book" || state.step === "first" || state.step === "bookmarks";
  const curious = curiousPicks(state);
  const resultPick = state.step === "result" ? curious[state.result] : undefined;
  // 10-02 (user): between screens, wait (≤ 3 s) for the book's cover so S-06 appears with its printed cover already there
  const waitingFor = resultPick?.card.id ?? null;
  useEffect(() => {
    if (!waitingFor || waitingFor === shownResult) return;
    let live = true;
    void waitForCover(waitingFor).then(() => { if (live) setShownResult(waitingFor); });
    return () => { live = false; };
  }, [waitingFor, shownResult]);

  return (
    <MotionConfig reducedMotion="user">
      {state.step === "home" && <Home onStart={start} library={library} />}
      {node && (
        // a new key per question shown (an answer or a step back): the tap guard and the hold start again
        <Question key={`${state.asked}-${state.answers.length}`} node={node} onAnswer={answer} onHoldCancel={holdCancelled} onBack={back} />
      )}
      {inBook && (
        <BookScene
          state={state}
          onOpen={open}
          onBack={back}
          onNext={nextPage}
          onRetry={() => act({ type: "retry" })}
          onReact={react}
          onHome={() => home("first_page")}
        />
      )}
      {resultPick && shownResult === resultPick.card.id && (
        <ResultBook key={resultPick.card.id} pick={resultPick} position={state.result + 1} total={curious.length} onNext={nextResult} onPrev={prevResult} />
      )}
      {resultPick && shownResult !== resultPick.card.id && <ResultLoading />}
      {state.step === "end" && <EndScreen onRedraw={redraw} onHome={() => home("end")} />}
    </MotionConfig>
  );
}
```

- [ ] **Step 12: 옛 화면 파일 지우기**

```bash
cd web
git rm src/components/flow/TargetInput.tsx src/components/flow/TargetInput.test.tsx src/components/flow/TargetInput.module.css \
  src/components/flow/BalanceGame.tsx src/components/flow/BalanceGame.test.tsx src/components/flow/BalanceGame.module.css \
  src/components/flow/FirstPage.test.tsx \
  src/lib/flow/order.ts src/lib/flow/order.test.ts src/lib/flow/questions.ts src/lib/flow/questions.test.ts \
  src/lib/flow/summary.ts src/lib/flow/summary.test.ts src/lib/flow/target.ts src/lib/flow/target.test.ts \
  e2e/flow-leaf.spec.ts e2e/flow-target.spec.ts e2e/understood.spec.ts
```
Run: `grep -rn "flow/order\|flow/questions\|flow/summary\|flow/target\|BalanceGame\|TargetInput" src e2e --include=*.ts --include=*.tsx`
Expected: 빈 출력. (남는 `Understood.*`·`lib/flow/examples.*`·`lib/goal/*`는 Task 7.)

- [ ] **Step 13: 전체 확인**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: 모두 PASS — `taxonomy.test.ts` #10 포함(이제 코드의 `track()` 이름 = live 이벤트). `src/styles/legacy-fallbacks.test.ts`가 `FirstPage.module.css`의 `.caption`을 찾으면 그 기대만 지운다(`grep -n caption src/styles/legacy-fallbacks.test.ts`로 확인 — 빈 출력이면 할 일 없음).

Run: `npx vitest run --coverage`
Expected: PASS, `src/lib/recommend/**`·`src/lib/paths/**` 100%.

- [ ] **Step 14: 커밋 (한 번)**

```bash
cd ..
git add docs/taxonomy.md docs/taxonomy.csv web
git commit -m "feat(flow): v2 question path screens with taxonomy v1.0 events

S-01 one entry, S-02 question map with back, S-04 path summary; removes the
balance game and the target input screens. New events question_answered,
question_back_clicked, path_completed; unsure_hold_cancelled props replaced;
common mode; six v1 input events marked removed.

- [x] events: taxonomy.md · taxonomy.csv · schema.ts changed together

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 🎯 남은 코드 없애기 (분류·Anthropic·옛 뽑기 모양)

**Files:**
- Delete: `web/src/lib/goal/` (전부), `web/src/app/api/goal/` (전부), `web/src/lib/server/llm.ts`, `web/src/lib/server/llm.test.ts`, `web/src/components/flow/Understood.tsx`, `web/src/components/flow/Understood.module.css`, `web/src/lib/flow/examples.ts`, `web/src/lib/flow/examples.test.ts`, `web/src/lib/books/active.ts`, `web/src/lib/books/active.test.ts`, `web/scripts/grade-goals.ts`
- Modify: `web/src/lib/books/catalog.ts`, `web/src/lib/books/draw.ts`, `web/src/lib/books/draw.test.ts`, `web/src/lib/books/request.ts`, `web/src/lib/books/request.test.ts`, `web/src/lib/books/types.ts`, `web/src/lib/books/data.test.ts`, `web/src/app/api/books/draw/route.ts`, `web/src/app/api/books/draw/route.test.ts`, `web/src/components/flow/BookScene.module.css`, `web/package.json`, `web/package-lock.json`, `web/playwright.config.ts`, `web/e2e/guard.spec.ts`

**Interfaces:**
- Consumes: Task 4·6.
- Produces: `parseDrawRequest(body: unknown, map?: QuestionMap): DrawRequest | null`, `interface DrawRequest { answers: Answer[]; seen: string[]; seed: number | null }`. POST `/api/books/draw`는 길 요청만 받는다(`entry`가 있는 옛 본문은 400). `DrawResponse`·`drawLeaf`·`drawTarget`·`ACTIVE_VOCAB` 없음.

먼저 읽기: `web/node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`.

- [ ] **Step 1: 실패하는 테스트로 바꾸기**

`web/src/lib/books/request.test.ts`를 통째로 바꾼다:
```ts
import { describe, expect, it } from "vitest";
import { SQL_PATH } from "@/lib/paths/__fixtures__/paths";
import { MAX_ANSWERS, MAX_SEEN, parseDrawRequest } from "./request";

describe("parseDrawRequest (v2 — a finished path of the question map)", () => {
  it("accepts a finished path with seen and seed", () => {
    expect(parseDrawRequest({ answers: SQL_PATH, seen: ["x"], seed: 3 })).toEqual({ answers: SQL_PATH, seen: ["x"], seed: 3 });
    expect(parseDrawRequest({ answers: SQL_PATH })).toEqual({ answers: SQL_PATH, seen: [], seed: null });
  });

  it("keeps only node and choice of each answer it accepts", () => {
    expect(parseDrawRequest({ answers: SQL_PATH.map((a) => ({ ...a })) })?.answers).toEqual(SQL_PATH);
  });

  it.each([
    ["not an object", "x"],
    ["a v1 🍃 body", { entry: "leaf", choices: ["A", "B", "A", "B", "A", "B", "A", "B", "A"] }],
    ["a v1 🎯 body", { entry: "target", answers: { topic: "통계", way: null, len: 0, keywords: [] } }],
    ["answers missing", {}],
    ["answers not a list", { answers: "start" }],
    ["no answers", { answers: [] }],
    ["an unfinished path", { answers: SQL_PATH.slice(0, -1) }],
    ["a question that was not asked", { answers: [{ node: "branch", choice: "A" }] }],
    ["an unknown choice", { answers: [{ node: "start", choice: "C" }, ...SQL_PATH.slice(1)] }],
    ["an extra key on an answer", { answers: [{ node: "start", choice: "A", text: "hi" }, ...SQL_PATH.slice(1)] }],
    ["a node id that is not a string", { answers: [{ node: 1, choice: "A" }] }],
    ["a node id over 64 characters", { answers: [{ node: "x".repeat(65), choice: "A" }] }],
    ["too many answers", { answers: Array.from({ length: MAX_ANSWERS + 1 }, () => ({ node: "start", choice: "A" })) }],
    ["an answer that is not an object", { answers: [null] }],
    ["seen that is not a list of ids", { answers: SQL_PATH, seen: "9790000000001" }],
    ["a seen id that is not a string", { answers: SQL_PATH, seen: [9790000000001] }],
    ["too many seen ids", { answers: SQL_PATH, seen: Array.from({ length: MAX_SEEN + 1 }, (_, i) => `${i}`) }],
    ["a negative seed", { answers: SQL_PATH, seed: -1 }],
    ["a seed that is not an integer", { answers: SQL_PATH, seed: 1.5 }],
  ])("refuses %s", (_, body) => {
    expect(parseDrawRequest(body)).toBeNull();
  });
});
```

`web/src/lib/books/draw.test.ts`: `describe("drawLeaf"…)`·`describe("drawTarget"…)` 블록을 지우고, import를 `import { drawPath } from "./draw";`로(쓰지 않게 된 `LEAF_CHOICES` 상수도 지움). Task 4의 `drawPath` 블록은 그대로.

`web/src/app/api/books/draw/route.test.ts`:
- `const NINE = …` → `import { SQL_PATH } from "@/lib/paths/__fixtures__/paths";` 와 `const PATH = { answers: SQL_PATH };`
- `"draws 🍃 books for nine balance answers"`·`"draws 🎯 books with the coverage count"` 두 테스트 삭제.
- 남는 테스트의 `{ entry: "leaf", choices: NINE, … }` → `{ ...PATH, … }` (예: `req({ ...PATH, seed: 11 })`, `req({ ...PATH, seed: i }, from("7.7.7.7"))`, `req(PATH, { origin: "https://evil.example", … })`).
- `it.each([...])` 400 표 → 
```ts
  it.each([
    ["not JSON", "{"],
    ["a v1 body", { entry: "leaf", choices: ["A", "B", "A", "B", "A", "B", "A", "B", "A"] }],
    ["an unfinished path", { answers: SQL_PATH.slice(0, 2) }],
    ["an unknown answer", { answers: [{ node: "start", choice: "C" }] }],
    ["seen that is not a list of ids", { ...PATH, seen: "9790000000001" }],
    ["a negative seed", { ...PATH, seed: -1 }],
  ])("answers 400 for %s", async (_, body) => {
    expect((await POST(req(body))).status).toBe(400);
  });
```
  (기존 표 아래 테스트 이름·assert 형식이 다르면 그 형식을 따른다 — 기대는 400.) Task 4의 "refuses an unfinished path with 400" 테스트는 위 표와 겹치므로 지운다.

`web/src/lib/books/data.test.ts`:
- import 5~9행(`shownExamples`, `classifySchema`·`classifySystemPrompt`, `matchGoal`, `MIN_ACTIVE_TOPIC_BOOKS`·`activeTopics`, `ACTIVE_VOCAB`)을 지우고 `import { TOPIC_CHIPS, TOPICS } from "./taxonomy";` → `import { TOPICS } from "./taxonomy";`.
- 테스트 7개 삭제: `"activates exactly the topics with 10+ books…"`, `"shows a chip only for an active topic…"`, `"a D-A draft pattern catches %s…"`(it.each), `"never sends an example chip to a keyword with fewer than 4 books…"`, `"word matching sends %s to %s…"`(it.each), `"word matching reads 회사 그만두고 싶어요…"`, `"keeps 마음·회복 in 습관·집중 only until 마음 돌보기 turns on…"`.

`web/e2e/guard.spec.ts`:
- draw 테스트의 `const body = { entry: "leaf", choices: [...] };` → `const body = { answers: SQL_PATH };`, 파일 위에 `import { SQL_PATH } from "../src/lib/paths/__fixtures__/paths";`.
- `"goal classify refuses another origin …"` 테스트 삭제.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/books src/app/api/books`
Expected: FAIL — `parseDrawRequest`가 아직 vocab을 받고 v1 본문을 받아들임.

- [ ] **Step 3: 서버 코드 줄이기**

`web/src/lib/books/request.ts`를 통째로 바꾼다:
```ts
import { PathError, QUESTION_MAP, walkPath, type Answer, type QuestionMap } from "@/lib/paths";

/** v2: a finished path of the question map. */
export interface DrawRequest { answers: Answer[]; seen: string[]; seed: number | null }

export const MAX_SEEN = 1000;
/** The longest path today is 11 answers; 40 leaves room for a longer map and caps the body. */
export const MAX_ANSWERS = 40;
const MAX_ID = 32;
const MAX_NODE = 64;
const CHOICES: ReadonlySet<unknown> = new Set(["A", "B", "unsure"]);

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

function parseSeen(x: unknown): string[] | null {
  if (x === undefined) return [];
  if (!Array.isArray(x) || x.length > MAX_SEEN) return null;
  return x.every((id) => typeof id === "string" && id.length > 0 && id.length <= MAX_ID) ? (x as string[]) : null;
}

/** undefined = invalid, null = not given. */
function parseSeed(x: unknown): number | null | undefined {
  if (x === undefined) return null;
  return typeof x === "number" && Number.isInteger(x) && x >= 0 && x < 2 ** 32 ? x : undefined;
}

/** A finished path of the map, each answer exactly { node, choice } — anything else is null. */
function parseAnswers(x: unknown, map: QuestionMap): Answer[] | null {
  if (!Array.isArray(x) || x.length === 0 || x.length > MAX_ANSWERS) return null;
  const ok = x.every((a) => isObject(a) && Object.keys(a).length === 2 && typeof a.node === "string"
    && a.node.length <= MAX_NODE && CHOICES.has(a.choice));
  if (!ok) return null;
  const answers = (x as Answer[]).map(({ node, choice }) => ({ node, choice }));
  try {
    return walkPath(map, answers).next === null ? answers : null;
  } catch (e) {
    if (e instanceof PathError) return null;
    throw e;
  }
}

/** Strict check of the draw body: anything unexpected is a 400, never a silent default. */
export function parseDrawRequest(body: unknown, map: QuestionMap = QUESTION_MAP): DrawRequest | null {
  if (!isObject(body)) return null;
  const seen = parseSeen(body.seen);
  const seed = parseSeed(body.seed);
  if (!seen || seed === undefined) return null;
  const answers = parseAnswers(body.answers, map);
  return answers ? { answers, seen, seed } : null;
}
```

`web/src/lib/books/draw.ts`를 통째로 바꾼다:
```ts
import { applyChallenge, drawForPath, pathReason, pathSummary, QUESTION_MAP, walkPath, type Answer, type QuestionMap } from "@/lib/paths";
import type { Rng } from "@/lib/recommend";
import { toBook, toCard } from "./catalog";
import type { CatalogBook, PathDrawResponse } from "./types";

/**
 * v2: answers of the question map → five bookmarks (lib/paths drawForPath). The answers must be a finished path —
 * parseDrawRequest checks that before this runs. Reasons come from the scope the books were drawn from (after the
 * challenge flip) and the person's mood.
 */
export function drawPath(answers: Answer[], seen: ReadonlySet<string>, rng: Rng, books: CatalogBook[], map: QuestionMap = QUESTION_MAP): PathDrawResponse {
  const walked = walkPath(map, answers);
  const res = drawForPath(books.map(toBook), map, walked, { seen, rng });
  const drawnFrom = applyChallenge(map, walked);
  const byId = new Map(books.map((b) => [b.isbn, b]));
  return {
    picks: res.picks.map((p) => ({ card: toCard(byId.get(p.book.id) as CatalogBook), kind: p.kind, reason: pathReason(p.book, drawnFrom) })),
    exhausted: res.exhausted,
    widened: res.widened || res.widenedScope,
    path: pathSummary(map, answers),
  };
}
```

`web/src/lib/books/types.ts`: `DrawResponse` 인터페이스와 그 위 주석(`POST /api/books/draw response. keywords: … found: …`)을 지운다. `CardPick`·`PathDrawResponse`는 그대로.

`web/src/app/api/books/draw/route.ts`를 통째로 바꾼다:
```ts
import { catalog } from "@/lib/books/catalog";
import { drawPath } from "@/lib/books/draw";
import { parseDrawRequest } from "@/lib/books/request";
import { guardJson } from "@/lib/server/guard";
import { mulberry32 } from "@/lib/recommend";

// 1000 seen ids × ~16 bytes + 40 answers stay well under this.
const MAX_BYTES = 32_000;
const PER_MINUTE = 60;

/** v2: POST { answers, seen?, seed? } — a finished path of the question map → five bookmarks + the path S-04 shows. */
export async function POST(request: Request): Promise<Response> {
  const guarded = await guardJson(request, { route: "draw", limit: PER_MINUTE, maxBytes: MAX_BYTES });
  if (!guarded.ok) return guarded.response;
  const parsed = parseDrawRequest(guarded.body);
  if (!parsed) return Response.json({ error: "invalid draw request" }, { status: 400 });

  const rng = mulberry32(parsed.seed ?? crypto.getRandomValues(new Uint32Array(1))[0]);
  return Response.json(drawPath(parsed.answers, new Set(parsed.seen), rng, catalog()));
}
```

`web/src/lib/books/catalog.ts`: `import vocab from "@/data/vocab.json";`, `import { activeTopics, activeVocab } from "./active";`, `ACTIVE_VOCAB` 상수와 그 주석을 지우고, `import type { BookCard, CatalogBook, Vocab } from "./types";` → `import type { BookCard, CatalogBook } from "./types";`. `library()` 주석의 `Real books always, like ACTIVE_VOCAB.` → `Real books always.`

- [ ] **Step 4: 🎯·Anthropic 파일과 의존성 지우기**

```bash
cd web
git rm -r src/lib/goal src/app/api/goal
git rm src/lib/server/llm.ts src/lib/server/llm.test.ts src/components/flow/Understood.tsx src/components/flow/Understood.module.css \
  src/lib/flow/examples.ts src/lib/flow/examples.test.ts src/lib/books/active.ts src/lib/books/active.test.ts scripts/grade-goals.ts
npm uninstall @anthropic-ai/sdk
```
`web/package.json` scripts에서 `"goal:grade": "tsx scripts/grade-goals.ts",` 줄을 지운다.
`web/playwright.config.ts`의 env에서 `ANTHROPIC_API_KEY: "",`를 지우고, 주석 `// YES24 / Kakao / Anthropic keys ""` → `// YES24 / Kakao keys ""`.
`web/src/components/flow/BookScene.module.css`에서 F-24 ③ 줄 두 개(`.scene[data-exits] { --exits-row: 56px; }`, `.exits > .full { flex: 1 1 100%; }`)를 지우고 `--exits-row: 0px;` 줄의 주석을 `/* kept at 0: the layout math below still reads it (F-24 ③ removed, v2) */`로.

Run: `grep -rln "lib/goal\|api/goal\|server/llm\|Understood\|flow/examples\|books/active\|ACTIVE_VOCAB\|anthropic\|ANTHROPIC\|\bDrawResponse\b\|drawLeaf\|drawTarget" src scripts e2e playwright.config.ts package.json`
Expected: 빈 출력. (`docs/`와 매일 파이프라인 `../src/pipeline/`은 건드리지 않는다 — 파이프라인의 `ANTHROPIC_API_KEY`는 GitHub Actions Secrets로 그대로 쓰인다.)

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run && npm run typecheck && npm run lint && npx vitest run --coverage`
Expected: 모두 PASS, `lib/recommend/**`·`lib/paths/**` 100%.

- [ ] **Step 6: 커밋**

```bash
cd ..
git add -A web
git commit -m "refactor: remove the target input, goal classification and Anthropic from the site

The draw API takes question-map paths only. The daily book pipeline keeps its own key.

- [x] events: no event change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: E2E — 갈림길 흐름과 나머지 스펙

**Files:**
- Modify: `web/e2e/helpers.ts`, `web/e2e/home-nav.spec.ts`, `web/e2e/result.spec.ts`, `web/e2e/scene.spec.ts`, `web/e2e/cover-peeks.spec.ts`, `web/e2e/first-guide.spec.ts`, `web/e2e/result-guide.spec.ts`, `web/e2e/library.spec.ts`, `web/e2e/privacy.spec.ts`, `web/e2e/amplitude.spec.ts`, `web/e2e/mailbox.spec.ts`
- Create: `web/e2e/flow-path.spec.ts`

**Interfaces:**
- Consumes: 화면 문구 `START_LABEL`·"이전 질문"·"질문으로 돌아가기"·"당신이 고른 길"·"갈피를 못 잡겠어요", 이벤트 E-32~34, 시험용 길(`SQL_PATH`·`MIXED_PATH`·`CHALLENGE_PATH`), `web/src/data/question-map.json`.
- Produces (helpers.ts): `START`, `labelOf(a: Answer): string | null`, `holdUnsure(page, ms?)`, `answerPath(page, answers)`, `answerToClosedBook(page, answers?)`, `toClosedBook(page, answers?)`, `toBookmarks(page, answers?)`.

- [ ] **Step 1: helpers.ts에 갈림길 도우미**

`web/e2e/helpers.ts` 맨 위 import 아래:
```ts
import built from "../src/data/question-map.json";
import { SQL_PATH } from "../src/lib/paths/__fixtures__/paths";
import type { Answer, QuestionMap } from "../src/lib/paths/types";

const MAP = built as QuestionMap;
/** S-01's one entry (PRD F-01 v2). */
export const START = "갈피 잡으러 가기";
/** Question.tsx ignores card taps in the first 250 ms of a question (a double tap must not answer the next one). */
const TAP_GUARD_MS = 250;

/** The card label for an answer, or null for 갈피를 못 잡겠어요 (the hold). */
export function labelOf(a: Answer): string | null {
  const n = MAP.nodes[a.node];
  return a.choice === "unsure" ? null : a.choice === "A" ? n.a.label : n.b.label;
}

/** Keyboard hold (Enter) — same timer as touch; deterministic on both projects. */
export async function holdUnsure(page: Page, ms = 1000) {
  await page.getByRole("button", { name: "갈피를 못 잡겠어요" }).focus();
  await page.keyboard.down("Enter");
  await page.waitForTimeout(ms);
  await page.keyboard.up("Enter");
}

/** Answers each question as it comes: waits for its heading, then taps the card (or holds 못 잡겠어요). */
export async function answerPath(page: Page, answers: readonly Answer[]) {
  for (const a of answers) {
    await expect(page.getByRole("heading", { level: 1, name: MAP.nodes[a.node].question, exact: true })).toBeVisible();
    const label = labelOf(a);
    if (label === null) {
      await holdUnsure(page);
      continue;
    }
    await page.waitForTimeout(TAP_GUARD_MS + 50);
    await page.getByRole("button", { name: label, exact: true }).click();
  }
}

/** From S-01 already on screen: [갈피 잡으러 가기] → the path → S-03 (the closed book). */
export async function answerToClosedBook(page: Page, answers: readonly Answer[] = SQL_PATH) {
  await page.getByRole("button", { name: START }).click();
  await answerPath(page, answers);
  await expect(page.getByText("눌러서 펼치기")).toBeVisible();
}

export async function toClosedBook(page: Page, answers: readonly Answer[] = SQL_PATH) {
  await page.goto("/");
  await answerToClosedBook(page, answers);
}

/** … → open the book (S-04) → [다음 장] (S-05, the first bookmark). */
export async function toBookmarks(page: Page, answers: readonly Answer[] = SQL_PATH) {
  await toClosedBook(page, answers);
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await page.getByRole("button", { name: "다음 장" }).click();
}
```

- [ ] **Step 2: 새 스펙 flow-path.spec.ts**

```ts
// web/e2e/flow-path.spec.ts
import { expect, type Page } from "@playwright/test";
import built from "../src/data/question-map.json";
import { CHALLENGE_PATH, MIXED_PATH, SQL_PATH } from "../src/lib/paths/__fixtures__/paths";
import type { QuestionMap } from "../src/lib/paths/types";
import { answerPath, holdUnsure, named, reactToBookmarks, recordEvents, specMismatches, START, test } from "./helpers";

test.use({ reducedMotion: "reduce" });

const MAP = built as QuestionMap;
/** PATH_SHOTS=<folder>: save S-01 / S-02 / S-04 screenshots for the design check (phone project). */
const SHOTS = process.env.PATH_SHOTS;
const heading = (page: Page, node: string) => page.getByRole("heading", { level: 1, name: MAP.nodes[node].question, exact: true });
const shot = async (page: Page, name: string) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

test("SQL path: eleven questions, no path or count while answering, then 당신이 고른 길 and five bookmarks (E-32 · E-25 · E-34)", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await expect(page.getByText("질문 몇 개면 한 권을 만나요")).toBeVisible();
  await shot(page, "s01-home");
  await page.getByRole("button", { name: START }).click();
  await expect(heading(page, "start")).toBeVisible();
  await holdUnsure(page, 300);                                            // let go early: still the first question
  await expect(heading(page, "start")).toBeVisible();
  await shot(page, "s02-first-question");
  await answerPath(page, SQL_PATH.slice(0, 8));
  await expect(heading(page, "learn-way")).toBeVisible();
  await expect(page.getByText(/\d+\s*\/\s*\d+/)).toHaveCount(0);           // no "n / 9"
  await expect(page.getByText("일을 더 잘하기")).toHaveCount(0);           // no crumbs while answering
  await shot(page, "s02-question");
  await answerPath(page, SQL_PATH.slice(8));

  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect(page.getByRole("heading", { name: "당신이 고른 길" })).toBeVisible();
  await expect(page.getByRole("region", { name: "지나온 길" })).toContainText("DB에서 꺼내기");
  await expect(page.getByRole("region", { name: "기분" })).toContainText("바로 따라 해 보기");
  await expect(page.getByText(/\d+권/)).toHaveCount(0);                    // no book-count note (design 10절)
  await shot(page, "s04-path");
  await page.getByRole("button", { name: "다음 장" }).click();
  await reactToBookmarks(page, ["패스", "패스", "패스", "패스", "패스"], 5);

  await expect.poll(() => named(events, "path_completed").length).toBe(1);
  const answered = named(events, "question_answered");
  expect(answered.map((e) => e.props.node_id)).toEqual(SQL_PATH.map((a) => a.node));
  expect(answered.map((e) => e.props.depth)).toEqual(SQL_PATH.map((_, i) => i + 1));
  expect(answered.map((e) => e.props.position)).toEqual(SQL_PATH.map((_, i) => i + 1));
  expect(answered[0].props).toMatchObject({ kind: "narrow", choice: "A" });
  expect(answered[0].common).toMatchObject({ entry: null, mode: null, screen_version: "v2" });
  expect(named(events, "unsure_hold_cancelled")[0].props).toMatchObject({ node_id: "start", depth: 1 });
  expect(named(events, "path_completed")[0]).toMatchObject({
    props: { scope_id: "entry=target;topics=데이터 분석;keywords=SQL", depth: 11, unsure_count: 0 },
    common: { entry: "target", mode: "normal" },
  });
  expect(named(events, "bookmark_shown")[0].common).toMatchObject({ entry: "target", mode: "normal" });
  expect(specMismatches(events)).toEqual([]);
});

test("갈피를 못 잡겠어요 at the branch: three questions, the whole library on the first page", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: START }).click();
  await answerPath(page, MIXED_PATH);
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect(page.getByRole("region", { name: "지나온 길" })).toContainText("책장 전체에서");
  await expect(page.getByRole("region", { name: "기분" })).toContainText("가볍게 얇은 책");
  await expect.poll(() => named(events, "path_completed").length).toBe(1);
  expect(named(events, "path_completed")[0]).toMatchObject({ props: { scope_id: "all", depth: 3, unsure_count: 1 }, common: { entry: null, mode: "normal" } });
  expect(named(events, "question_answered")[1].props).toMatchObject({ node_id: "branch", choice: "unsure" });
  expect(specMismatches(events)).toEqual([]);
});

test("challenge route: the far side's books, the one-line note on the first page, the same bookmark look", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: START }).click();
  await answerPath(page, CHALLENGE_PATH);
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect(page.getByText("평소의 당신과 반대편에서 골랐어요")).toBeVisible();
  await expect(page.getByRole("region", { name: "지나온 길" })).toContainText("여기 없는 딴 세상");
  await shot(page, "s04-challenge");
  await page.getByRole("button", { name: "다음 장" }).click();
  await expect(page.getByText("1 / 5")).toBeVisible();
  await expect.poll(() => named(events, "bookmark_shown").length).toBe(1);
  expect(named(events, "path_completed")[0]).toMatchObject({
    props: { scope_id: "entry=leaf;genres=시,에세이", depth: 9, unsure_count: 1 }, common: { entry: "leaf", mode: "challenge" },
  });
  expect(specMismatches(events)).toEqual([]);
});

test("[← 이전 질문] drops the last answer; on the first question it goes home in a new round (E-33 · E-20)", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: START }).click();
  await answerPath(page, SQL_PATH.slice(0, 2));                              // 평소 → 뭔가 배우기
  await expect(heading(page, "learn-intro")).toBeVisible();
  const back = page.getByRole("button", { name: "이전 질문" });
  expect((await back.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await back.click();
  await expect(heading(page, "branch")).toBeVisible();
  await answerPath(page, [{ node: "branch", choice: "A" }]);                // now 이야기에 빠지기
  await expect(heading(page, "story-intro")).toBeVisible();

  await expect.poll(() => named(events, "question_answered").length).toBe(3);
  expect(named(events, "question_back_clicked").map((e) => e.props)).toEqual([{ node_id: "branch", depth: 2, source: "question" }]);
  expect(named(events, "question_answered").map((e) => [e.props.node_id, e.props.depth, e.props.position])).toEqual([
    ["start", 1, 1], ["branch", 2, 2], ["branch", 2, 3],
  ]);

  await page.getByRole("button", { name: "이전 질문" }).click();            // story-intro → branch
  await page.getByRole("button", { name: "이전 질문" }).click();            // branch → start
  await expect(heading(page, "start")).toBeVisible();
  await page.getByRole("button", { name: "이전 질문" }).click();            // the first question → S-01
  await expect(page.getByRole("button", { name: START })).toBeVisible();
  await expect.poll(() => named(events, "home_clicked").length).toBe(1);
  expect(named(events, "home_clicked")[0]).toMatchObject({ props: { curious_count: 0, source: "question" }, common: { round: 1 } });
  await page.getByRole("button", { name: START }).click();
  await expect.poll(() => named(events, "entry_selected").length).toBe(2);
  expect(named(events, "entry_selected")[1].common).toMatchObject({ round: 2, entry: null, mode: null });
  expect(specMismatches(events)).toEqual([]);
});

test("S-04 [← 질문으로 돌아가기]: the same answer keeps the five books, another answer draws anew", async ({ page }) => {
  const { events } = await recordEvents(page);
  let draws = 0;
  await page.route("**/api/books/draw", (route) => { draws += 1; return route.continue(); });
  await page.goto("/");
  await page.getByRole("button", { name: START }).click();
  await answerPath(page, SQL_PATH);
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect(page.getByRole("button", { name: "다음 장" })).toBeEnabled();

  await page.getByRole("button", { name: "질문으로 돌아가기" }).click();
  await expect(heading(page, "learn-len")).toBeVisible();
  await answerPath(page, [{ node: "learn-len", choice: "A" }]);              // the same answer
  await expect(page.getByRole("heading", { name: "당신이 고른 길" })).toBeVisible();
  await expect(page.getByRole("button", { name: "다음 장" })).toBeEnabled();
  expect(draws).toBe(1);

  await page.getByRole("button", { name: "질문으로 돌아가기" }).click();
  await answerPath(page, [{ node: "learn-len", choice: "B" }]);              // another answer
  await expect(page.getByRole("region", { name: "기분" })).toContainText("깊게 파고들기");
  await expect(page.getByRole("button", { name: "다음 장" })).toBeEnabled();
  expect(draws).toBe(2);

  expect(named(events, "question_back_clicked").map((e) => e.props)).toEqual([
    { node_id: "learn-len", depth: 11, source: "first_page" }, { node_id: "learn-len", depth: 11, source: "first_page" },
  ]);
  expect(named(events, "path_completed")).toHaveLength(3);
  expect(named(events, "book_opened")).toHaveLength(1);                     // the book stayed open
  expect(specMismatches(events)).toEqual([]);
});

test("a reload mid-path resumes the same question and keeps counting answers", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: START }).click();
  await answerPath(page, SQL_PATH.slice(0, 3));
  await expect(heading(page, "learn-area")).toBeVisible();
  await page.reload();
  await expect(heading(page, "learn-area")).toBeVisible();
  await answerPath(page, SQL_PATH.slice(3));
  await expect(page.getByText("눌러서 펼치기")).toBeVisible();
  await expect.poll(() => named(events, "path_completed").length).toBe(1);
  expect(named(events, "question_answered").map((e) => e.props.position)).toEqual(SQL_PATH.map((_, i) => i + 1));
  await page.reload();
  await expect(page.getByText("눌러서 펼치기")).toBeVisible();              // S-03 resumes too
  expect(specMismatches(events)).toEqual([]);
});
```

- [ ] **Step 3: 나머지 스펙을 새 입구로**

각 파일에서(왼쪽 → 오른쪽):

- `home-nav.spec.ts`:
  - import에 `START`, `answerPath`를 더하고 `import { SQL_PATH } from "../src/lib/paths/__fixtures__/paths";`.
  - `START_LEAF`·`START_TARGET` 상수 두 줄 삭제. `startLeaf` → 
```ts
async function startPath(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: START }).click();
  await expect(page.getByRole("heading", { level: 1, name: "오늘은 어느 쪽으로 걸어 볼까요?" })).toBeVisible();
}
```
    (모든 `startLeaf(page)` → `startPath(page)`.)
  - `expectHome` 본문 → `await expect(page.getByRole("button", { name: START })).toBeVisible();`
  - `await expect(page.getByText("1 / 9")).toBeVisible();` (세 곳) → `await expect(page.getByRole("heading", { level: 1, name: "오늘은 어느 쪽으로 걸어 볼까요?" })).toBeVisible();`
  - `"the visit of a fresh open mid-flow …"` 테스트: `await startPath(page);` 다음 줄에 `await answerPath(page, SQL_PATH.slice(0, 2));` 를 넣고 `toMatchObject({ round: 1, entry: "leaf" })` → `({ round: 1, entry: "target", mode: "normal" })`, `({ round: 2, entry: null })` → `({ round: 2, entry: null, mode: null })`. 테스트 이름의 `no entry` → `no branch or route`.
- `result.spec.ts`:
  - import에 `START`, `answerPath`, `toBookmarks as openBookmarks`, `SQL_PATH`(위와 같은 경로).
  - 로컬 `toBookmarks` 함수를 지우고, 그 함수를 부르던 곳을 `await openBookmarks(page);`로.
  - `"S-08 [다시 뽑기] …"` 테스트: `await page.getByRole("button", { name: /그냥 한 권 만나고 싶어요/ }).click();`부터 9번 루프 끝(`}`)까지 → `await page.getByRole("button", { name: START }).click();` `await answerPath(page, SQL_PATH);`. `"한 번 고치기"` → `"질문으로 돌아가기"`(주석 `// a new round's one edit` → `// the way back stays on a new round`). `[[{ curious_count: 0 }, 1, "leaf"]]` → `[[{ curious_count: 0 }, 1, "target"]]`. `expect(named(events, "balance_answered")).toHaveLength(9);` → `expect(named(events, "question_answered")).toHaveLength(11);`.
- `scene.spec.ts` `walkTheBook`: `await page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click();` 부터 `// S-02 submit` 줄까지 세 줄 → `await page.getByRole("button", { name: START }).click();` `await answerPath(page, SQL_PATH);` (import 추가). `"당신이 찾는 책"` → `"당신이 고른 길"`.
- `cover-peeks.spec.ts`: 로컬 `toClosedBook`을 지우고 `import { test, toClosedBook } from "./helpers";`. `"당신이 찾는 책"` → `"당신이 고른 길"`.
- `first-guide.spec.ts` 로컬 `toFirstBookmark` 본문 → `addInitScript` 줄은 두고 나머지를 `await toBookmarks(page);`로 (import `toBookmarks`).
- `result-guide.spec.ts` 로컬 `toFirstResult`: `await page.goto("/");`부터 `"다음 장"` 클릭까지 → `await toBookmarks(page);` (import).
- `library.spec.ts` 로컬 `toFirstResult`: 첫 네 줄(🎯 버튼·데이터 분석·책 펼치기 ×2) → `await answerToClosedBook(page);` `await page.getByRole("button", { name: "책 펼치기" }).click();` (import `answerToClosedBook`).
- `privacy.spec.ts` 첫 테스트: 이름 `"S-02 → 처리방침 link → /privacy → 처음으로"`, `page.getByRole("button", { name: /알고 싶은 게 있어요/ }).click()` → `page.getByRole("button", { name: START }).click()`; 끝의 두 expect(🎯·🍃 버튼) → `await expect(page.getByRole("button", { name: START })).toBeVisible();` 주석 `// 처음으로 is a fresh open: S-01, not the question it left`. (import `START`.)
- `amplitude.spec.ts`: `/알고 싶은 게 있어요/` 두 곳 → `START` (import).
- `mailbox.spec.ts`: `{ name: /그냥 한 권 만나고 싶어요/ }` → `{ name: START }` (import), 테스트 이름 `"the mailbox sits below the entry, …"`.

Run: `grep -rn "알고 싶은 게\|그냥 한 권\|1 / 9\|당신이 찾는 책\|한 번 고치기\|balance_answered" e2e`
Expected: 빈 출력.

- [ ] **Step 4: E2E 실행**

Run: `npx playwright test e2e/flow-path.spec.ts`
Expected: 6 tests × 2 projects PASS.

Run: `npx playwright test`
Expected: 모든 스펙 PASS. **테스트 서버(포트 3217)가 끝나고도 내려가지 않을 때가 있다** — 로그 마지막에 `N passed`(실패 0)가 찍히면 끝난 것이다. 명령이 돌아오지 않으면 그 줄을 확인한 뒤 남은 서버를 끈다: Git Bash `netstat -ano | grep :3217` → 마지막 칸의 PID로 `taskkill //PID <PID> //F` (PowerShell: `Get-NetTCPConnection -LocalPort 3217 | % { Stop-Process -Id $_.OwningProcess -Force }`).

- [ ] **Step 5: 사용자용 스크린샷**

Run: `mkdir -p ../docs/mockups/2026-10-04-v2 && PATH_SHOTS=../docs/mockups/2026-10-04-v2 npx playwright test e2e/flow-path.spec.ts --project=phone`
Expected: `docs/mockups/2026-10-04-v2/`에 `s01-home.png`, `s02-first-question.png`, `s02-question.png`, `s04-path.png`, `s04-challenge.png`. (Windows PowerShell이면 `$env:PATH_SHOTS="../docs/mockups/2026-10-04-v2"; npx playwright test …`.) 사용자에게 다섯 장을 보여 주고 확인을 받는다(디자인 결정은 시각 비교로).

- [ ] **Step 6: 커밋**

```bash
cd ..
git add web/e2e docs/mockups/2026-10-04-v2
git commit -m "test(e2e): question-path flows — SQL, unsure branch, challenge, back, reload

- [x] events: no event change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: 마지막 확인과 기록

**Files:**
- Modify: `docs/HANDOFF.md`, `docs/tasks.md`, `docs/context.md`

**Interfaces:**
- Consumes: Task 1~8 전부.
- Produces: 병합 준비가 된 `feat/v2-screens`(병합·배포는 사용자 승인 뒤).

- [ ] **Step 1: 단위 테스트 + 커버리지**

Run: `cd web && npm run test:cov`
Expected: 모든 테스트 PASS, `src/lib/recommend/**`·`src/lib/paths/**` lines/branches/functions/statements 100% (임계 실패 0).

- [ ] **Step 2: 타입·린트·빌드**

먼저 읽기(빌드 경고가 나면): `web/node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/` 중 경고에 나온 항목.

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 오류 0, 빌드 성공(`/`·`/privacy`·`/api/books/draw` 라우트가 목록에 있고 `/api/goal/classify`는 없음).

- [ ] **Step 3: 지도 보고서**

Run: `npm run map:coverage`
Expected: 표와 마지막 줄 `<N> ends · <M> with fewer than 4 books`. 4권 미만 길 수 `M`을 HANDOFF에 적는다(계획 3의 입력 — 책이 0권인 장르·주제도 지도에서 빼지 않는다).

- [ ] **Step 4: 전체 E2E**

Run: `npx playwright test`
Expected: 모두 PASS. 로그 끝에 `N passed`가 보였는데 명령이 돌아오지 않으면 포트 3217의 남은 서버를 끈다(Task 8 Step 4의 명령).

- [ ] **Step 5: Anthropic·🎯이 사이트에 없는지 마지막 확인**

Run: `grep -rn "anthropic\|ANTHROPIC\|goal/classify\|free_goal_written\|chip_selected" web/src web/e2e web/package.json web/playwright.config.ts`
Expected: 한 줄만 — `web/src/lib/track/schema.test.ts`의 "없어진 이름" 목록(`for (const gone of [...])`). 다른 줄이 나오면 그 코드를 지운다(`removed` 이벤트 이름은 `docs/taxonomy.*`와 그 검사 목록에만 남는다).

- [ ] **Step 6: 기록**

`docs/HANDOFF.md` 맨 위 "지금 상태"에 넣는다:
```markdown
- **v2 계획 2 완료 (`feat/v2-screens`, 병합 전)**: S-01 입구 하나 · S-02 갈림길(이전 질문, 진행 표시 없음) · S-04 당신이 고른 길 · 서버 뽑기 = 질문 지도 길 · taxonomy v1.0(E-32 `question_answered`, E-33 `question_back_clicked`, E-34 `path_completed`, 공통 `mode`, 🎯·밸런스 이벤트 6개 removed) · 처리방침 v2 · 사이트 Anthropic 0. 길 끝 <N>개 중 4권 미만 <M>개(`npm run map:coverage`). 스크린샷 `docs/mockups/2026-10-04-v2/`. **남은 일**: 사용자 확인 → 병합·배포(사용자) → 배포 뒤 Supabase `events`에 `screen_version`=v2와 `question_answered` 확인, Amplitude 대시보드에 FN-7 퍼널 → 계획 3(모자란 길 채우기).
```
`docs/tasks.md` 🛠 개발 목록에 `- [x] v2 계획 2 — 화면·이벤트 v1.0·🎯 없애기 (\`docs/plans/2026-10-04-galpi-v2-plan2-screens.md\`, \`feat/v2-screens\`) — 병합·배포는 사용자`를 넣는다. `docs/context.md`의 `Last Updated:` 줄 날짜를 실행한 날로.

- [ ] **Step 7: 커밋**

```bash
cd ..
git add docs/HANDOFF.md docs/tasks.md docs/context.md
git commit -m "docs: record Galpi v2 plan 2 results and what is left

- [x] events: no event change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-Review (작성자 확인)

- **설계 범위**: 2절 화면 흐름 → Task 5·6 (S-01 Home, S-02 Question, S-04 PathPage, S-03/05/06 그대로). 3절 지도 → 엔진(계획 1) + `QUESTION_MAP`(Task 3). 4절 도전 → `applyChallenge`(계획 1)·S-04 한 줄(Task 5)·E-34 scope_id(Task 5·6)·도전 책갈피 없음(10절). 5절 뽑기 → 서버(Task 4·7), 책 수 안내 없음(Task 5·6 BookScene). 6절 기록 → Task 6 + 처리방침 Task 2. 7절 순서 1·4 → Task 1·2·3~8. 10절 시안 결정 전부 → Global Constraints. 5절-6·7(시뮬레이션·매일 작업)은 계획 3.
- **이름 일치**: `QUESTION_MAP`·`pathSummary`/`PathSummary`·`pathReason`(Task 3) → `drawPath`/`PathDrawResponse`(Task 4) → `nextQuestion`·`isPath`·`sameAnswers`·`pathCommon`·`completedProps`·`Question`·`PathPage`(Task 5) → `FlowState.answers/asked/drawnFor`·`DrawView.path`·`setMode`·`BACK_TO_QUESTIONS`·`START_LABEL`(Task 6) → `parseDrawRequest(body, map?)`(Task 7) → e2e `START`·`answerPath`·`toClosedBook`·`toBookmarks`(Task 8).
- **이벤트**: live 27 = 30 − 6 removed + 3 new. E-25는 이름 그대로 속성만 바뀜(줄 교체 — csv 한 이벤트의 상태는 하나여야 하므로 옛 속성 줄은 변경 기록으로).
