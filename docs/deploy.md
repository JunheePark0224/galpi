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
| `SUPABASE_SERVICE_ROLE_KEY` | 설정 (**Sensitive/secret**) | 설정 안 함 | 서버에서만 쓰는 키. `NEXT_PUBLIC_` 접두사를 붙이지 않는다 |
| `NEXT_PUBLIC_CONTACT_EMAIL` | 설정 | 설정 | `/privacy`에 표시되는 문의 이메일. 빌드 때 박히므로 바꾸면 다시 배포 |
| `TRACK_STORE` | 설정 안 함 | **`off`** | Preview 배포가 실제 `events`에 쓰지 않게 한다 |
| `BOOKS_SOURCE` | **어디에도 두지 않는다** | 두지 않는다 | `sample`은 테스트용 30권 — 두면 실제 책이 안 나온다 |

- [ ] Production 값과 Preview 값을 위 표대로 각 환경 칸에 따로 넣었다
- [ ] `SUPABASE_SERVICE_ROLE_KEY`는 Sensitive로 표시했다 (저장 후 다시 볼 수 없게)
- [ ] Preview에 `SUPABASE_*`를 넣지 않아도 `TRACK_STORE=off`가 있으면 저장되지 않는다 (둘 다 막는 편이 안전)

## 4. Supabase

- [ ] `web/supabase/migrations/0001_init.sql`을 이미 실행했다 (`events` 테이블)
- [ ] SQL Editor에서 `web/supabase/migrations/0002_retention.sql` 실행 — 1년 지난 기록을 매일 지우는 pg_cron 작업
  - `create extension`에서 권한 오류가 나면 Database → Extensions → pg_cron을 켠 뒤 다시 실행
- [ ] `select * from cron.job;`에 `galpi-events-retention`이 보인다

## 5. 배포 후 확인 (Production URL에서, 휴대폰으로도)

- [ ] 첫 화면이 뜬다 → Supabase에서 visit이 저장됐는지:
  ```sql
  select created_at, name, common->>'device' as device
  from events
  where name = 'visit'
  order by created_at desc
  limit 5;
  ```
- [ ] 🎯 한 바퀴 (칩 → 책 → 첫 장 → 책갈피 5개 → 궁금해요 목록)
- [ ] 🍃 한 바퀴 (밸런스 9문항 → 책 → 책갈피 5개)
- [ ] `/design`이 **404**다
- [ ] `/robots.txt`에 `Disallow: /design`, `Disallow: /api/`가 있다
- [ ] `/privacy`에 문의 이메일이 보인다 (없다는 문구가 아니라)
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

## 알아 둘 것

- 요청 한도(`/api/track` 분당 120, `/api/books/draw` 분당 60)는 서버리스 인스턴스 메모리에 있어 인스턴스마다 따로 센다. 스크립트 하나가 `events`를 채우는 것을 막는 정도이고, 트래픽이 커지면 Vercel Firewall이나 Upstash 같은 공유 저장소로 바꾼다.
- 같은 출처 확인은 브라우저 요청만 걸러 낸다. 브라우저 밖에서 `Origin`을 직접 붙여 보내는 것은 막지 못한다 (한도와 크기·형식 검사가 그 몫).
- 이 배포에는 로그인·저장이 없다 (P5). 카카오·구글 로그인 설정은 그때 한다.
