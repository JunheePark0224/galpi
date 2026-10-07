# 뒤표지 + 공유 (10-07, 사용자 결정)

시안: `scratchpad/deco/back.png` A안 (툭 올려 둔 5장 + "내가 고른 길" 라벨). 사용자 결정 10-07:
- 다섯 번째 책갈피 뒤, **책의 뒤표지**가 마지막 장이다 — 앞표지(S-03)로 시작해 뒤표지로 끝난다. 위에 꽂혀 있던 책갈피는 없고,
  뒤표지(가죽) 위에 오늘 만난 5장이 살짝씩 기울어 놓여 있다. 아래 주 버튼 [궁금해요 n권 책 정보 보기 →](0권이면 [다시 갈피 잡기 →]) +
  보조 [↗ 공유하기].
- 뒤표지 아래쪽 종이 라벨 **"내가 고른 길"** — **5장 모두에 맞는 선택만** 칩으로 올린다(운명 1장이 어긋난 선택은 빠짐). 도전이면
  "오늘은 낯선 쪽으로 도전"은 늘 들어간다. 맞는 선택이 하나도 없으면 "기분 따라 골랐어요".
- 운명 1장은 그대로(표시 없음).
- 공유되는 것 = 뒤표지만(예스24 표지·소개 없음): 링크 미리보기 가로 1200×630 + 스토리 세로 1080×1920.

## 설계

1. **라벨 (순수 함수, `lib/share/label.ts`)** — `shareLabel(map, answers, books): { chips: string[]; challenge: boolean }`.
   답마다 고른 선택의 효과로 5권을 대조: 범위 효과(entry·genres·topics·keywords)는 `inScope`처럼, 기분 효과는 축 값이 같음(temp 등),
   len은 THIN_MAX/THICK_MIN, ways는 책의 방식이 목록 안. 효과가 없는 선택(초입 "떠오르는 게 있어요", 평소 모드)은 칩이 아니다.
   도전(mode=challenge)은 칩이 아니라 `challenge: true`(화면이 "오늘은 낯선 쪽으로 도전"을 맨 앞에). 칩은 길 순서, 같은 글 중복 없음.
2. **공유 코드 (`lib/share/code.ts`)** — 답(지도 노드 순번 + A/B/U) + 5권 ISBN + 그림 5개(동물·배경·땅 순번) → base64url.
   `decodeShare`는 모두 검사(끝난 길, 카탈로그의 책, 그림 값) — 틀리면 null. 서명 없음(누구나 아무 5권을 만들 수 있지만 우리 화면
   하나를 그릴 뿐, 기록·도감과 무관). 개인정보 없음.
3. **뽑기 응답**에 `label`(1번 결과)을 싣는다 — 클라이언트에는 태그가 없으므로 서버가 계산.
4. **흐름**: Step에 `"back"` 추가. 마지막 반응 → `back` → 주 버튼이 `result`(궁금해요 있으면) 또는 `end`. `back`은 다시 보이지 않음.
5. **화면 `BackCover`** (C-29): 뒤표지 가죽(앞표지와 같은 결, 책등은 오른쪽) + 5장(기존 `Bookmark` 작은 판, fx light) + 라벨.
   [↗ 공유하기]: `navigator.share({ title, text, url })`(+ 가능하면 스토리 PNG 파일), 없으면 링크 복사 + "링크를 복사했어요" + [이미지 저장].
6. **공유 페이지 `/s/[code]`** (S-11): 같은 뒤표지 + "○○님이 만난 책갈피" 대신 "누군가 갈피에서 만난 책갈피" + 주 버튼 [나도 갈피 잡기].
   메타데이터 og:image = `/s/[code]/opengraph-image` (1200×630, next/og). 스토리 = `/s/[code]/story` (1080×1920 PNG).
   코드가 틀리면 404 대신 첫 화면으로.
> 10-07 뒤 변경: [이미지 저장]은 없애고 [이미지로 공유], E-42 method "save_image" → "image", 카카오톡 안 브라우저는 브라우저로 넘김 (`context.md` 10-07, taxonomy v2.1)

7. **이벤트 (taxonomy v2.0)**: E-41 `back_cover_shown`(curious_count, label_count), E-42 `share_clicked`(method: native|copy|save_image),
   E-43 `share_page_viewed`(유입 — label_count), E-44 `share_page_started`(나도 갈피 잡기). 공통 속성 그대로. 모으는 정보:
   새 개인정보 없음(공유 코드 = 답 + 책 + 그림). 처리방침에 "공유 링크에는 고른 답·책·그림만 담긴다" 한 줄.
8. **PRD**: F-27 공유, S-10 뒤표지, S-11 공유 페이지, E-41~44. DESIGN: C-29 뒤표지, C-30 공유 이미지.

## 순서 (TDD)
1. PRD · DESIGN · taxonomy(md·csv) · 처리방침 문구
2. `lib/share/label.ts` + 테스트 (100% — 추천 로직 근처)
3. `lib/share/code.ts` + 테스트
4. 뽑기 응답 `label` + route 테스트
5. state `back` + 테스트, Flow 연결, `BackCover` + 테스트, 이벤트 E-41·E-42 (schema.ts → 테스트 → track)
6. `/s/[code]` 페이지 + og 이미지 + 스토리 PNG, E-43·E-44
7. e2e: 마지막 책갈피 → 뒤표지 → 공유(복사 fallback) → 공유 페이지 → 나도 갈피 잡기
8. 시안 대조 스크린샷 → 사용자 확인 → 배포
