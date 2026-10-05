# 공개 전 점검 — 앱 안 브라우저 · 작은 휴대폰 (2026-10-05)

> `launch-plan.md` 4절 "휴대폰 실제 점검"의 자동 점검분. 실제 휴대폰 점검(사용자)을 대신하지 않는다.
> 스크린샷: `mockups/2026-10-05-launch/` (뷰포트마다 한 장 `sheet-<폭>x<높이>.jpg`, 개요 `sheet-overview-ig-ios.jpg`, 고친 것 전후 `fix-*.jpg`, 남은 문제 `issue-*.jpg`).
> 다시 돌리기: `cd web && LAUNCH_SWEEP=<폴더> TRACK_STORE=off npx playwright test e2e/launch-sweep.spec.ts --project=phone` (보통 실행에서는 건너뜀).

## 1. 어떻게 봤나

- **브라우저 7종 (User-Agent 흉내)**: 인스타그램 앱 안(iOS·안드로이드), 스레드 앱 안(iOS), 카카오톡 앱 안(안드로이드), 링크드인 앱 안(iOS), 모바일 Safari, 안드로이드 Chrome.
- **화면 크기 5종**: 320×568, 360×740, 375×667, 390×844, 412×915 (터치·모바일 모드, 화면 배율 2).
- **흐름**: 홈 → 질문(SQL 예시 길 10문항) → S-03 닫힌 책 → S-04 → S-05 책갈피 5장 → S-06 결과 → 로그인 창(열기만) → 내 책갈피(가짜 로그인, `library.spec.ts`와 같은 방식) → 도감 탭 → 처리방침. 35조합 모두 끝까지 통과.
- **화면마다 잰 것**: 가로 넘침, 잘린 글자(스스로 또는 부모 상자 밖으로), 44px보다 작은 버튼, 다른 것에 가려진 버튼, 고정 막대끼리 겹침, 화면 아래로 밀려난 버튼.
- **한계**: 이 컴퓨터에는 Chromium만 있다(WebKit 없음). iOS의 UA도 Chromium 엔진으로 그렸으므로 **iOS 고유 동작(Safari·WKWebView의 툴바, 길게 누름 메뉴, svh 계산)은 확인하지 못했다.** 앱의 위·아래 막대도 흉내 내지 않았다 — 대신 앱 안 높이에 가까운 375×559를 따로 테스트했다. UA에 따라 화면이 달라지는 코드는 없고, 실제로 7종의 측정값이 뷰포트마다 모두 같았다.

## 2. `is_in_app_browser` 판별

| 브라우저 | 고치기 전 | 지금 | 비고 |
|---|---|---|---|
| 인스타그램 iOS·안드로이드 | TRUE | TRUE | UA의 `Instagram` |
| 스레드 | **FALSE** | TRUE | UA에 `Barcelona`(스레드의 코드 이름)만 있음 → 추가 (taxonomy v1.4) |
| 카카오톡 | TRUE | TRUE | `KAKAOTALK` |
| 링크드인 | **FALSE** | TRUE | `LinkedInApp` → 추가 (taxonomy v1.4) |
| 모바일 Safari · 안드로이드 Chrome | FALSE | FALSE | |

단위 테스트(`common.test.ts`)와 점검 스펙이 7종을 모두 확인한다. 10-05 이전 기록에서는 스레드·링크드인이 FALSE로 남아 있다.

## 3. 문제 목록

| # | 화면 | 크기·브라우저 | 문제 | 처리 | 근거 |
|---|---|---|---|---|---|
| 1 | S-04 | 320×568 (모든 UA), 375×559(앱 안 높이) | **[← 질문으로 돌아가기]가 한 줄을 다 차지해 [다음 장]이 둘째 줄로 밀리고 화면 밖(아래)으로 나감** (알려진 문제) | **고침** — 폭 359px 이하에서 버튼 최소 폭 120 → 88px (`BookScene.module.css`). 두 버튼이 한 줄, 둘 다 44px 이상 | `fix-s04-320.jpg`, `e2e/small-phone.spec.ts` |
| 2 | S-04 | 320×568, 375×559 | **마지막 기분 줄이 책장 밖으로 64px 넘쳐 책장 안 스크롤에 숨음** (알려진 문제) | **고침** — 높이 600px 이하에서 줄 간격 6 → 2px, 책장 위아래 여백 16 → 12px (`FirstPage.module.css`). 그보다 긴 길이 생겨도 책장 스크롤은 그대로 | `fix-s04-320.jpg`, `e2e/small-phone.spec.ts` |
| 3 | 모든 화면의 아래 줄 | 320 폭 | "처리방침" 링크가 "처 / 리방침"으로 끊기고, 누르는 곳이 42×17px (44px 규칙 미달, 모든 크기) | **고침** — 한 덩어리로 묶고 위아래 14px 여백을 음수 여백으로 되돌려 줄 위치는 그대로 (`Footer.tsx`) | `fix-footer-320.jpg`, `e2e/small-phone.spec.ts` |
| 4 | S-06 결과 | 320×568, 360×740, 375×667 | 주 버튼 [예스24에서 보기]·[다음 책]이 첫 화면 아래(스크롤해야 보임). 책 표지가 화면 대부분을 차지 | **사용자 결정** — 디자인 문제(책 크기와 버튼 위치). 결과 화면은 원래 스크롤하는 화면이라 버그로 보지 않았다 | `issue-s06-320-below-fold.jpg`, `issue-s06-375-below-fold.jpg` |
| 5 | S-07 로그인 창 | 320×568 | 창이 화면보다 길어 [Google로 계속하기] 아래쪽·안내 문구·처리방침·[닫기]가 창 안을 스크롤해야 보임 (카카오 버튼은 보임). 창 바깥(어두운 곳)을 눌러 닫을 수 있음 | **사용자 결정** — 예시 책장 그림을 작은 화면에서 줄일지는 디자인 결정 | `issue-s07-320-sheet-scroll.jpg` |
| 6 | 로그인 (앱 안 브라우저) | 앱 안 5종 | 앱 안 브라우저를 위한 처리가 **없다**. [Google로 계속하기]를 누르면 그대로 구글 로그인 화면으로 간다 — 구글은 앱 안 브라우저(WebView) 로그인을 막으므로(`disallowed_useragent` 오류 화면) 인스타그램·스레드·링크드인·카톡 안에서는 실패할 것이다. 카카오 로그인은 앱 안에서도 되는 방식. 실제 OAuth는 여기서 끝까지 해 볼 수 없다 | **사용자 결정** — PRD F-20("브라우저에서 열기" 안내)이 미뤄진 상태. 홍보 유입 대부분이 앱 안 브라우저이므로 공개 전 우선순위를 다시 볼 만하다. 선택지: ① 앱 안에서는 구글 버튼 아래 "구글은 Safari/Chrome에서 열어 주세요" 한 줄 ② 카톡은 `kakaotalk://web/openExternal?url=`로 바깥 브라우저 열기, 안드로이드는 `intent://` ③ 그대로 두고 Q-14로 실패율만 보기 | 코드 (`LoginSheet.tsx`, `lib/auth/browser.ts`) |
| 7 | S-05·S-06 책갈피 | iOS (확인 못 함) | 책갈피 그림의 동물은 `<img>`라 iOS에서 길게 누르면 "이미지 저장" 메뉴가 뜰 수 있다. 꾹 누르는 버튼(갈피를 못 잡겠어요)과 내 책갈피 끌기에는 `-webkit-touch-callout: none`이 이미 있다 | **실기기 확인** — Chromium으로는 재현 불가. 아이폰 인스타그램에서 S-06 책갈피를 길게 눌러 보기 | `HoldButton.module.css`, `Library.module.css`, `BookmarkArt.tsx` |
| 8 | 마우스 올림(hover) | — | hover에 기능이 묶인 곳 없음. 우체통 그림 밝아짐·[🔖 꽂기] 색 진해짐은 꾸밈뿐(꽂기는 터치 뒤 색이 남을 수 있음 — 꾸밈). S-06 "눌러서 꺼내기" 안내는 `hover: hover`인 기기에만 | 문제 없음 | CSS 검사 |
| 9 | S-04 | 360 이상 | 책이 펼쳐지는 약 0.5초 동안 표지가 버튼 위에 있음(누름이 표지에 감) | 문제 없음 — 0.5초 뒤 버튼이 맨 위, 기존 E2E가 눌러 통과 | 점검 측정 |
| 10 | 가로 넘침·고정 막대 겹침 | 35조합 전부 | 없음 | — | 점검 측정 |
| 11 | S-04 | 320×568 | 큰 빈 공간: 책 위 약 112px는 S-05 책갈피가 올라올 자리라 S-04에서는 비어 보인다 | **사용자 결정(작음)** — 1·2를 고친 뒤 [다음 장]은 화면 안이다 | `fix-s04-320.jpg` |

## 4. 바꾼 것 (CSS만, 각각 E2E로 고정)

- `web/src/components/flow/BookScene.module.css` — `@media (max-width: 359px) { .actions > button { min-width: 88px } }`
- `web/src/components/flow/FirstPage.module.css` — `@media (max-height: 600px)`에서 `.row` 간격·`.page` 여백 줄임
- `web/src/components/Footer.tsx` — 처리방침 링크 `inline-block · nowrap · padding 14px 4px · margin -14px -4px`
- `web/e2e/small-phone.spec.ts` — 320×568·375×559에서 S-04 두 버튼 한 줄·화면 안·44px, 마지막 기분 줄이 책장 안, 처리방침 링크 한 줄·44px
- `web/e2e/launch-sweep.spec.ts` — 이 점검 (`LAUNCH_SWEEP`이 있을 때만)
