# 로그인 화면에 supabase 주소 대신 "갈피"가 보이게 (10-07, 사용자 결정 A + C)

로그인할 때 구글·카카오 화면에 `○○○.supabase.co(으)로 이동`처럼 Supabase 주소가 보인다. 이 화면은 우리 코드가 아니라
구글·카카오가 그리므로, 각 콘솔에서 앱 이름·로고를 넣어 바꾼다. **모두 사용자가 직접** (로그인·콘솔 설정은 사용자 몫).

- A. 구글 — 브랜드 인증을 받으면 "갈피(으)로 이동"으로 바뀐다. 인증은 며칠 걸릴 수 있다.
- C. 카카오 — 앱 이름·아이콘을 넣으면 바로 동의 화면에 나온다.
- 안 되면(구글 인증이 supabase 주소 때문에 막히는 경우가 있다) B. Supabase 맞춤 도메인(유료, 도메인 필요)으로 간다.

## 넣을 값

| 항목 | 값 |
|---|---|
| 앱 이름 | 갈피 |
| 로고 | 구글: `docs/launch/galpi-logo-120.png` (120 × 120) · 카카오: `docs/launch/galpi-logo-512.png` (512 × 512) |
| 홈페이지 | https://galpi-omega.vercel.app |
| 개인정보 처리방침 | https://galpi-omega.vercel.app/privacy |
| 지원 이메일 | 사용자 이메일 |

## A. 구글 (Google Cloud Console)

1. https://console.cloud.google.com → 갈피 로그인에 쓰는 프로젝트 선택 → **Google 인증 플랫폼(Google Auth Platform)**.
2. **브랜딩(Branding)**
   - 앱 이름: `갈피`
   - 사용자 지원 이메일: 내 이메일
   - 앱 로고: `galpi-logo-120.png` 올리기
   - 앱 도메인 — 홈페이지: `https://galpi-omega.vercel.app`, 개인정보처리방침: `https://galpi-omega.vercel.app/privacy`
   - 승인된 도메인: `galpi-omega.vercel.app` 추가 (Supabase 주소 `○○○.supabase.co`가 이미 있으면 그대로 둔다)
   - 개발자 연락처 이메일: 내 이메일 → 저장
3. **대상(Audience)** → 게시 상태가 "테스트"면 **앱 게시(Publish app)** → "프로덕션". (테스트 상태는 등록한 테스트 사용자만 로그인할 수 있다 — 출시 전 꼭.)
4. 승인된 도메인 소유 확인을 요구하면: Google Search Console(https://search.google.com/search-console)에서 `https://galpi-omega.vercel.app`을 **URL 접두어** 속성으로 추가 → 확인 방법 **HTML 태그** → 나오는 `<meta name="google-site-verification" content="…">`의 content 값을 Claude에게 주면 사이트에 넣어 배포한다(값은 비밀이 아니다).
5. 브랜딩 화면으로 돌아가 **브랜드 인증 요청(Verify branding)**. 결과는 메일로 온다.

확인: 인증 후 로그아웃 상태에서 구글 로그인 → 계정 고르는 화면에 "갈피(으)로 이동"이 보이면 끝.

## C. 카카오 (Kakao Developers)

1. https://developers.kakao.com → 내 애플리케이션 → 갈피 앱.
2. **앱 설정 → 일반**
   - 앱 이름: `갈피`
   - 앱 아이콘: `galpi-logo-512.png`
   - (사업자명은 개인이면 비워 둬도 된다)
3. **카카오 로그인 → 동의항목** 화면 위쪽 미리보기에 이름·아이콘이 바뀌었는지 본다.

확인: 로그아웃 상태에서 카카오 로그인 → 동의 화면에 갈피 아이콘과 이름이 보이면 끝.
