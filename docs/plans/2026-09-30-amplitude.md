# Amplitude 연결 (P6 일부를 앞당김) — 2026-09-30

**근거:** 사용자 결정(09-30 채팅) — 강사 요청으로 Amplitude 설치 안내문(Amplitude wizard, `@amplitude/unified` + `initAll`)을 따르되, 두 가지는 사용자가 바꿈: **Session Replay 20%**(안내문 100%), **갈피 이벤트 24개도 Amplitude로 보냄**(안내문은 확인용 1개). PRD F-16(처리방침)·F-17(기록), 로드맵 3-2(`track()` 하나).

## Global Constraints

- 패키지·호출은 안내문 그대로: `npm install @amplitude/unified@^1`, `import * as amplitude from '@amplitude/unified'`, **`amplitude.initAll(key, { analytics: { autocapture: true, ... }, sessionReplay: { sampleRate: 0.2, ... } })`** — `init` 금지. 옵션 이름은 설치된 패키지의 타입에서 확인(지어내지 않는다)
- 키는 환경변수 **`NEXT_PUBLIC_AMPLITUDE_API_KEY`** (공개 수집용 키). 코드·git·문서에 값을 쓰지 않는다. Vercel **Production에만** 넣는다 → 로컬 dev·E2E·Preview에서는 키가 없어 Amplitude가 꺼진다. 키가 없으면 `console.warn('Amplitude API key missing — analytics disabled')` 한 번(테스트·E2E에서 소음이 되면 개발 모드에서만 조용히 — 판단해서 설명)
- 초기화는 클라이언트에서 **한 번만**(모듈 수준 가드). 루트 레이아웃에 들어가는 작은 클라이언트 컴포넌트
- **deviceId = 갈피 익명 번호**(`lib/track/common`의 anon_id, 읽기만·없으면 기존 getOrCreate 규칙대로) → Supabase `events.common.anon_id`와 Amplitude device_id가 같아 한 사람으로 이어진다. 세션은 Amplitude 기본 세션 사용
- `track()`(lib/track/client.ts)은 **기존 Supabase 경로를 그대로 두고** Amplitude로도 같은 이벤트 이름·props를 보낸다(공통 속성 중 분석에 필요한 것 — entry, round, screen_version, device, in_app_browser, returning — 은 이벤트 속성으로 함께). Amplitude가 꺼져 있거나 실패해도 Supabase 전송·화면은 영향 없음(try/catch)
- 확인용: 안내문 6단계대로 **로드 때 이벤트 하나**에 `prompt_version: 'BA400.4'` — 우리 `visit` 이벤트를 Amplitude로 보낼 때 이 속성을 붙인다(새 이름을 만들지 않는다. 사용자가 24개를 그대로 보내기로 함)
- **Session Replay**: `sampleRate: 0.2`, 입력칸·직접 쓴 글은 가림(패키지의 privacy/mask 옵션을 타입에서 확인해 기본보다 약하지 않게 — 입력 요소 전부 가림). 저사양 폰 부담을 줄이는 옵션이 있으면 기본값 유지
- **처리방침 `/privacy` 갱신**(약속: "새로 전달하는 곳이 생기면 먼저 적는다"): Amplitude(분석 서비스, 미국 서버)로 같은 행동 기록 전달 / 자동 수집(페이지 이동·누른 요소) / **방문자 5명 중 1명꼴 화면 움직임 녹화(입력한 글은 가림)** / 보관 기간은 Amplitude 쪽 정책에 따른다는 말 대신 "1년"을 Amplitude 데이터 보관 설정으로 맞춘다고 적지 말 것 — 확실하지 않은 약속은 쓰지 않는다: "Amplitude에 전달된 기록도 삭제 요청 시 함께 지워요"만. 모으는 항목 표와 "다른 곳에 주지 않아요" 문단을 사실대로 고친다. 문구는 해요체, 짧게
- 문서: PRD F-16·F-17 한 줄, `context.md` 09-30 결정 한 줄, `deploy.md` 환경변수 표에 `NEXT_PUBLIC_AMPLITUDE_API_KEY`(Production만), `web/.env.example`의 `AMPLITUDE_API_KEY=`(서버 전용이라고 적힌 옛 줄)을 `NEXT_PUBLIC_AMPLITUDE_API_KEY=`(값 비움)로 바꾼다
- CSP는 지금 `frame-ancestors`만이라 막히지 않음 — 확인만

## 테스트
- Vitest: 키 없으면 init 안 함 + 경고 1번 / 키 있으면 `initAll`이 정확히 한 번, 옵션(autocapture true, sessionReplay.sampleRate 0.2, deviceId = anon_id) — 모듈을 목(mock)으로 / `track()`이 Supabase 경로와 Amplitude 둘 다 부르고, Amplitude가 throw해도 Supabase는 호출됨 / `visit`에만 `prompt_version`
- 처리방침 테스트 갱신, E2E 전부 통과(키가 없으므로 Amplitude 네트워크 요청이 없어야 함 — E2E 한 개로 `api2.amplitude.com`·`*.amplitude.com` 요청 0건 확인)
- `npm run typecheck && npm run lint && npm run test:cov && npm run e2e && npm run build`

## 커밋
`feat(analytics): send events to Amplitude with autocapture and 20% session replay` / `docs: disclose Amplitude in the privacy page and deploy checklist`
