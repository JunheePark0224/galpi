# 첫 공개 배포 체크리스트 — 갈피 (Vercel Hobby)

Last Updated: 2026-09-30

배포는 **사용자가 직접** 한다. 이 문서에는 환경변수 **이름**만 적는다. 값(키)은 어디에도 적지 않고, 대화에도 붙여 넣지 않는다.

## 1. GitHub 저장소

- [ ] 저장소는 **비공개**로 시작한다. 공개로 바꾸기 전에 확인:
  - [ ] `git ls-files | grep -i env` 결과에 `.env.local`이 없다 (`.env.example`·`.env.development`만 있어야 한다)
  - [ ] `web/.env.local`에 값이 있어도 `.gitignore`에 걸려 올라가지 않는다
  - [ ] 커밋 기록·문서에 키 값을 붙여 넣은 적이 없다 (있으면 그 키는 새로 발급)
- [ ] 저장소 루트가 `Galpi/`이므로 앱은 `web/` 폴더다.

## 2. Vercel에서 프로젝트 만들기

- [ ] Vercel → Add New → Project → GitHub 저장소 import
- [ ] **Root Directory: `web`** (저장소 구조가 다르면 `package.json`이 있는 폴더)
- [ ] Framework Preset: Next.js (자동 인식)
- [ ] **Node.js Version: 24.x** (Settings → General. `package.json`의 `engines`도 24.x)
- [ ] Build/Install 명령은 기본값 그대로 (`npm run build`)

## 3. 환경변수 (Settings → Environment Variables)

| 이름 | Production | Preview | 비고 |
|---|---|---|---|
| `SUPABASE_URL` | 설정 | 설정 안 함 | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 설정 (**Sensitive/secret**) | 설정 안 함 | 서버에서만 쓰는 키. `NEXT_PUBLIC_` 접두사를 붙이지 않는다. 도감 v1부터 도감 기록(`collection` 쓰기)도 이 키로 |
| `COLLECTION_SIGNING_SECRET` | **설정 (사용자, Sensitive)** | 설정 안 함 | 도감 v1(10-05): 뽑기 그림 seed에 서명하는 비밀값. **32자 이상 무작위**(예: PowerShell `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))`(PowerShell 7) 또는 비밀번호 관리자 생성기) — 대화·코드에 붙이지 않는다. 없으면 Production에서 도감 기록이 꺼진다(사이트·그림은 그대로, 배지 없음). 바꾸면 그 전에 받은 뽑기는 기록되지 않을 뿐. 넣은 뒤 다시 배포 |
| `NEXT_PUBLIC_CONTACT_EMAIL` | 설정 | 설정 | `/privacy`에 표시되는 문의 이메일. 빌드 때 박히므로 바꾸면 다시 배포 |
| `NEXT_PUBLIC_AMPLITUDE_API_KEY` | 설정 | **설정 안 함** | Amplitude 공개 수집용 키(브라우저에 들어가는 키라 `NEXT_PUBLIC_`). 빌드 때 박히므로 바꾸면 다시 배포. 없으면 Amplitude가 꺼지고 콘솔에 경고 한 줄만 남는다 |
| `TRACK_STORE` | 설정 안 함 | **`off`** | Preview 배포가 실제 `events`에 쓰지 않게 한다 |
| `BOOKS_SOURCE` | **어디에도 두지 않는다** | 두지 않는다 | `sample`은 테스트용 30권 — 두면 실제 책이 안 나온다 |
| `YES24_API_KEY` | 설정 (**Sensitive**) | 설정 안 함 | S-06 책 정보(P4). 서버에서만 읽는다. 없으면 카카오로, 둘 다 없으면 책 정보 없이 화면만 |
| `KAKAO_REST_KEY` | 설정 (**Sensitive**) | 설정 안 함 | 예스24가 실패할 때 표지·가격만 대신(PRD F-14) |
| `ANTHROPIC_API_KEY` | ~~설정~~ **넣지 않는다** | 설정 안 함 | v2(10-04)부터 사이트는 Claude를 부르지 않는다 — Vercel에서 **지운다**. 매일 태깅 파이프라인용 키는 GitHub Actions secret으로만 둔다(아래 96행 근처) |

- [ ] Anthropic Console에서 이 키 전용 workspace를 만들고 월 사용 한도를 걸었다 — 지금 **$15**(10-01에 $5에서 올림: 라이브 분류기와 매일 책 파이프라인이 같은 워크스페이스를 쓴다. 7절) — 사용자가 직접
- [ ] Production 값과 Preview 값을 위 표대로 각 환경 칸에 따로 넣었다
- [ ] `SUPABASE_SERVICE_ROLE_KEY`는 Sensitive로 표시했다 (저장 후 다시 볼 수 없게)
- [ ] Preview에 `SUPABASE_*`를 넣지 않아도 `TRACK_STORE=off`가 있으면 저장되지 않는다 (둘 다 막는 편이 안전)

## 4. Supabase

- [ ] `web/supabase/migrations/0001_init.sql`을 이미 실행했다 (`events` 테이블)
- [ ] SQL Editor에서 `web/supabase/migrations/0002_retention.sql` 실행 — 1년 지난 기록을 매일 지우는 pg_cron 작업
  - `create extension`에서 권한 오류가 나면 Database → Extensions → pg_cron을 켠 뒤 다시 실행
- [ ] `select * from cron.job;`에 `galpi-events-retention`이 보인다
- [ ] (도감 v1) SQL Editor에서 `web/supabase/migrations/0004_collection.sql` 실행 → 이어서 `web/supabase/checks/collection_rls.sql` 실행, 마지막 "RLS CHECK RESULT" 상자의 줄이 모두 `ok`
- [ ] (v1.7.1 로그인 전 저장 → 도감, `fix/guest-dex`) **배포한 뒤** `web/supabase/migrations/0007_kept_claims.sql`을 (다시) 실행 — 사람이 자기 세션으로 책갈피를 넣는 권한(`saves_own_insert`)을 없애고 서버만 넣게 한다(다시 실행해도 안전). 그다음 `web/supabase/checks/p5_rls.sql` · `decorate_rls.sql` · `kept_claims_rls.sql`을 각각 실행, "RLS CHECK RESULT" 상자의 줄이 모두 `ok`(kept_claims는 K1~K15). 번호 0006은 `fix/art-guard`의 것 — 그 브랜치의 `checks/art_guard.sql`도 책갈피를 서버 역할로 넣도록 고쳐야 0007 뒤에 통과한다
- [ ] **Vercel Production에 `SUPABASE_SERVICE_ROLE_KEY`가 있어야 저장이 된다** (v1.7.1 — 책갈피는 서버가 service role로 넣는다). 없으면 [내 책갈피에 저장]이 503(실패로 닫힘, "저장하지 못했어요"), 도감 기록도 꺼진다. 키 값은 화면·로그에 쓰지 않는다
- [ ] (꾸미기) `0005_original_art.sql` 실행 → `web/supabase/checks/decorate_rls.sql`, 줄이 모두 `ok`
- [ ] (꾸미기 보안, 0005 다음) `0006_art_guard.sql` 실행 → `web/supabase/checks/art_guard.sql`, 11줄이 모두 `ok`

## 5. 배포 후 확인 (Production URL에서, 휴대폰으로도)

- [ ] 첫 화면이 뜬다 → Supabase에서 visit이 저장됐는지:
  ```sql
  select created_at, name, common->>'device' as device
  from events
  where name = 'site_visited'
  order by created_at desc
  limit 5;
  ```
- [ ] 🎯 한 바퀴 (칩 → 책 → 첫 장 → 책갈피 5개 → 궁금해요 목록)
- [ ] 🍃 한 바퀴 (밸런스 9문항 → 책 → 책갈피 5개)
- [ ] `/design`이 **404**다
- [ ] `/robots.txt`에 `Disallow: /design`, `Disallow: /api/`가 있다
- [ ] `/privacy`에 문의 이메일이 보인다 (없다는 문구가 아니라)
- [ ] Production에서 첫 화면을 열면 Amplitude Live/User Lookup에 `site_visited`(`prompt_version` = `BA400.4`)가 뜨고, 그 device_id가 Supabase `events.common->>'anon_id'`와 같다
- [ ] Amplitude 프로젝트의 Session Replay 설정이 샘플링 20%·입력 가림이다 (대시보드 값이 코드의 값보다 우선한다)
- [ ] **개인정보 확인 (키를 Production에 넣은 직후, 직접 쓴 글이 Amplitude에 없는지)** — 🎯 직접 쓰기로 한 바퀴를 돌리고 (리플레이는 20% 샘플이라 안 남을 수 있다 — 안 보이면 새 탭으로 몇 번 더 돌린다):
  - [ ] Amplitude Live/User Lookup의 `free_goal_written`에 `goal_text`가 **없다** (`topic`·`keywords`·`is_matched`·`method`만). Supabase `events.props`에는 `goal_text`가 있다
  - [ ] Session Replay에서 그 세션을 열면 직접 쓰기 입력 칸의 글자가 가려져 있다
  - [ ] 같은 리플레이에서 S-04 첫 장(직접 쓴 글이 보이는 화면)의 글자가 가려져 있다
  - [ ] 첫 장에서 누른 요소의 `[Amplitude] Element Clicked` 이벤트에 직접 쓴 글이 `*****`로만 보이고 원문이 없다
  - [ ] 하나라도 보이면 키를 바로 Production에서 빼고 원인을 찾는다 (코드의 `data-amp-mask`와 대시보드 설정 둘 다 확인)
- [ ] Preview 배포에서는 Amplitude로 나가는 요청이 없다 (키를 Preview에 넣지 않았으니)
- [ ] 다른 사이트에서 `/api/track`을 부르면 403이다 (선택):
  ```
  curl -i -X POST https://<배포 주소>/api/track -H "Content-Type: application/json" -H "Origin: https://example.com" -d "{}"
  ```
- [ ] Preview 배포(브랜치 푸시)로 한 바퀴 돌려 보고, `events`에 새 줄이 **생기지 않는지** 확인

## 6. 테스트 기록 지우기

배포 확인 중 쌓인 테스트 이벤트가 분석에 섞이지 않게 한다. **사용자가 지울 범위를 확인한 뒤에만** 실행한다. 먼저 개수를 본다:

```sql
select count(*) from events where created_at < '<배포 시각, 예: 2026-10-01 09:00+09>';
```

확인 후:

```sql
delete from events where created_at < '<배포 시각>';
```

## 7. 매일 책 파이프라인 (GitHub Actions, D-B)

- [ ] Anthropic Console → `galpi` 워크스페이스 → 월 사용 한도 **$15** (10-01에 정함 — 라이브 `/api/goal/classify`와 **같은 워크스페이스·같은 한도**라서, 파이프라인이 한도를 다 쓰면 그 달 남은 동안 사이트의 직접 쓰기 분류도 단어 매칭으로 떨어진다. 파이프라인은 하루 50권에 약 $0.57(권당 약 $0.0115, Sonnet 5.5 두 번), 처음 채우기 전체에 약 $5)
- [ ] Settings → Secrets and variables → Actions → New repository secret: **`YES24_API_KEY`**, **`ANTHROPIC_API_KEY`**(`galpi` 워크스페이스 키) — 이름만 여기 적고 값은 어디에도 적지 않는다 (키는 `Tag today's books` 한 단계에만 들어가고 출력되지 않는다. `ANTHROPIC_LOG`는 설정하지 않는다 — 켜면 요청 본문의 예스24 글이 로그에 찍힌다)
- [ ] Settings → Actions → General → Workflow permissions: **Read and write permissions** + **Allow GitHub Actions to create and approve pull requests**
- [ ] 워크플로는 main에 있어야 돈다: `daily-books`(매일 06:00 KST, 손으로 실행하면 `dry_run` 기본), `weekly-sample`(월 09:00 KST, `auto_merge`가 true일 때만 이슈)
- [ ] 열린 `books/` PR이 있으면 그날은 쉰다 — 검수·병합하면 다음 날 이어서 (`dry_run`은 돈다)
- 손으로 실행할 때 입력: `dry_run`(기본 켬 — PR 없이 끝까지), `count`(이번 권수, 최대 100, 비우면 `daily_count`), `next_batch`(기본 끔 — 켜면 오늘 이미 main에 책이 있어도 같은 날 다음 묶음 `<날짜>-2`, `-3` …을 돈다. 열린 `books/` PR이 있으면 여전히 쉰다). 같은 날 여러 번: `gh workflow run daily-books.yml -f next_batch=true -f count=100 -f dry_run=false` → 검수·병합 → 다시 (`HANDOFF.md` 3절)
- [ ] 첫 한 바퀴: Actions → daily-books → Run workflow → `dry_run` 켜 둔 채 `count` 5 → 끝나면 실행 화면의 Summary(PR 본문 미리보기)와 Artifacts의 `dry-run-<날짜>`(우리 태그 파일·요약, 7일)를 본다
- 검수 없이 PR을 병합해도 **두 AI가 엇갈린 책은 앱에 들어가지 않는다**(파일에 `status: "review"`로 남고, 검수 `--apply`가 넣기·빼기를 정한다). 두 AI가 같게 본 책만 병합과 함께 앱에 들어간다
- 설정: `data/pipeline/config.json`(`daily_count`·`auto_merge`·`sample_rate`·`model`·`second_model`). `auto_merge`는 졸업 기준을 **둘 다** 넘고 **사용자가 승인했을 때만** true — ① 연속 3회, 사람이 본 책(엇갈린 책 + 일치 책 표본)의 모든 항목 95%+ ② 그 3회에 본 일치 책이 10권 이상이고 바뀐 책이 5% 이하. 검수 때 두 숫자가 함께 출력되고 PR 본문 맨 아래에도 보인다. 일치한 책 중 표본 밖은 사람이 보지 않는다. 첫 번째 기준(엇갈린 책이 섞인 행의 모든 항목 95%+)은 키워드가 특히 어려워 잘 안 넘을 수 있다 — 자동 병합 전환은 3~5일보다 오래 걸리기 쉽고, 두 번째 기준(일치 책 표본)만으로 판단할지는 사용자가 정한다
- 검수: 그날 PR 브랜치에서 `PYTHONIOENCODING=utf-8 python -m src.pipeline.review <날짜>`(같은 날 다음 묶음이면 `<날짜>-2` 같은 묶음 이름) → 로컬 페이지(예스24 글이 보이므로 `data/processed/check/`에만 저장, 커밋 안 함) → 내려받기 → `--apply <파일>` → `cd web && npm run books:import` → PR 브랜치에 커밋. 엇갈린 책과 함께 두 AI가 같게 본 책의 10% 표본도 기본으로 보인다(끄려면 `--no-sample`)
- 매일 할 일 — **PR의 키워드 후보 확인 → 5권 이상이면 사용자에게 물어 promote**: 본문 "### 키워드 후보"는 넣은 🎯 책에 AI·검수자가 적은 목록 밖 키워드 이름을 (주제, 이름)별로 센 것(모든 추가 파일, 공백·대소문자 무시). 5권 이상은 "추가할까요?"로 위에 보인다. 사용자가 승인하면 단어 규칙·정의 문장(사용자 확인)을 정해 `PYTHONIOENCODING=utf-8 python src/backfill_keywords.py promote "주제:이름" --pattern "…" --definition "…"` → `cd web && npm run books:import && npx vitest run` → 커밋. 승인 없이는 만들지 않는다(`plans/2026-10-02-keyword-candidates.md`)
- 실패하면 그날은 PR이 없고 Actions 기록에 이유(예스24 경로 이름·오류 종류)만 남는다. 도중에 멈추면(`partial`) 된 만큼만 PR에 들어가고 본문 맨 위에 이유가 보인다. 예스24 책소개·목차는 어디에도 남지 않는다

## 알아 둘 것

- 요청 한도(`/api/track` 분당 120, `/api/books/draw` 분당 60, `/api/books/[isbn]` 분당 60, `/api/goal/classify` 분당 10 + Claude 호출 하루 300번)는 서버리스 인스턴스 메모리에 있어 인스턴스마다 따로 센다. 스크립트 하나가 `events`를 채우거나 Claude 호출 비용을 키우는 것을 막는 정도이고 (하루 300번은 인스턴스마다·UTC 날짜 기준, 다 쓰면 단어 매칭으로 답한다), 트래픽이 커지면 Vercel Firewall이나 Upstash 같은 공유 저장소로 바꾼다.
- 같은 출처 확인은 브라우저 요청만 걸러 낸다. 브라우저 밖에서 `Origin`을 직접 붙여 보내는 것은 막지 못한다 (한도와 크기·형식 검사가 그 몫).
- 이 배포에는 로그인·저장이 없다 (P5). 카카오·구글 로그인 설정은 그때 한다.

## 함수 지역 (10-02)

- `web/vercel.json`의 `regions: ["icn1"]` — 서버 함수를 서울에서 돌린다(Supabase가 한국 가까이). 확인: `curl -sI https://galpi-omega.vercel.app/api/me | grep -i x-vercel-id` → `icn1::icn1::…`(마지막 앞 칸이 함수 지역)
