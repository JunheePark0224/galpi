# 갈피 우체통 (PRD F-26) Implementation Plan

**왜 (10-02, 사용자)**: 친구 5명 시험에서 써 본 사람이 느낀 점을 웹 안에서 바로 남기게 — 메일 앱을 열 필요 없이.
처음 화면(S-01)에만, 책 고르는 두 입구보다 **눈에 덜 띄게**(시안 A를 작고 조용하게, DESIGN C-18).

**흐름**
1. S-01 두 입구 아래 작은 놋쇠 투입구 버튼 → 아래 시트 "갈피 우체통" (글칸 500자, [넣기])
2. 브라우저 → `POST /api/feedback { text, common }` (같은 출처 · 분당 5회 · 4KB)
3. 서버: 글 확인(앞뒤 공백 제거, 1~500자) → `recordEvent()`(= `/api/track`과 같은 `saveEvent` + 세션으로 확인한 `user_id`)로
   `events`에 E-31 `feedback_sent` { `feedback_text`(Supabase only), `text_length` } → 저장되면 Resend 도착 알림(시각만) → 201
4. 화면: 2xx면 편지가 투입구로 들어가는 움직임 + "고마워요, 잘 받았어요", `trackStored()`로 Amplitude 사본(`text_length`만)
5. 실패하면 글을 그대로 두고 "보내지 못했어요…"

**지키는 것**: 글은 Supabase에만 — Amplitude·로그·알림 메일·DOM 속성에 두지 않음, 글칸 `data-amp-mask`. `/api/track`은 E-31을 받지 않음.
테스트·E2E는 실제 `events`에 쓰지 않음(`TRACK_STORE=off`), E2E는 Resend 키도 비움. 키 값은 출력하지 않음.

## Tasks
- [x] T1 PRD F-26 · E-31 · S-01 (먼저)
- [x] T2 처리방침 표 한 줄 + "기록을 전달하는 곳" 문단 (Amplitude 아님, Resend 알림은 시각만), 갱신일 2026-10-02, 테스트
- [x] T3 taxonomy v0.10: md(버전 표·동사 `sent`·분류 `홈`·2-7 예외·4-1·E-31 상세·4-3·6-1·6-2·6-3e·7-3 #10·8절) + csv 2줄
- [x] T4 `schema.ts` EVENT_SPEC `feedback_sent` + `OWN_ROUTE_EVENTS`, `client.ts` `trackStored()`(track()은 E-31 금지), taxonomy 테스트 #10이 `trackStored("…"`도 셈
- [x] T5 `lib/track/record.ts`로 `/api/track`의 저장·user_id 확인을 꺼내 공유, `/api/track`은 E-31 거절
- [x] T6 `/api/feedback` 라우트 + `lib/feedback/letter.ts`(한 규칙) + `lib/server/notify.ts`(Resend, 3초, 하루 50통) + 단위 테스트
- [x] T7 `components/feedback/Mailbox.tsx`·`MailSlot.tsx`(Motion, 줄이기 설정 존중), `Sheet`가 textarea도 초점 대상, Home에 배치 + 테스트
- [x] T8 `web/.env.example`에 `RESEND_API_KEY=`·`FEEDBACK_NOTIFY_TO=`(빈 칸), playwright env 비움
- [x] T9 E2E `e2e/mailbox.spec.ts` (열기·빈 글·보내기·고마워요·실패·배치), 375px 스크린샷 확인
- [x] T10 DESIGN C-18, context.md
- [x] T11 리뷰 반영: 설정 빠진 저장은 503(`TRACK_STORE=off`만 202), 고마움 묶음으로 초점 이동, 그림만 흐리게(글자 대비 4.5 : 1 이상), `track()`·`trackStored()` 실행 중 막기, 보내는 동안 시트 닫힘 막기, 오류 문장을 `aria-describedby`에, 라우트 로그 검사 넓힘

**사용자가 할 일 (배포 전)**: Resend 가입·API 키 발급 → Vercel Production에 `RESEND_API_KEY`, `FEEDBACK_NOTIFY_TO`(받을 주소) 넣기.
`onboarding@resend.dev` 발신은 Resend 가입 메일 주소로만 보낼 수 있으니 `FEEDBACK_NOTIFY_TO`는 그 주소로.
