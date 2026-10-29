# 인수인계 — 갈피 (Galpi)

Last Updated: 2026-10-29 (계정 이전 마지막 날 — 책 묶음 10-29, 정의서 v3.13. 이전 판 `archive/HANDOFF-2026-10-05.md`)

**새 Claude는 이 문서를 처음부터 끝까지 읽고 시작한다.** 그다음 필요할 때 `context.md`(결정 기록, 10-29까지 최신)를 본다.
`process.md`·`tasks.md`는 10-06 이후 갱신되지 않았다 — 지금 상태는 이 문서와 `context.md`가 맞다.

---

## 1. 한눈에

- **사이트**: https://www.galpibook.com — 10-09 공개, 운영 중. 저장소 = GitHub `JunheePark0224/galpi` (공개), **main에 push하면 Vercel이 자동 배포**.
- **서재**: 1,503권 (10-29 기준, 🍃 789 · 🎯 714). 책은 거의 이틀마다 100권씩 추가한다(아래 3-1).
- **정의서**: `docs/label-dictionary.md` **v3.13** (최근 바뀐 것은 아래 3-1-1) (책 태그 기준. 0~5절은 AI 태그 지시문에 그대로 들어간다).
- **A/B 실험** `back_cover_pick` 진행 중 — **2026-11-02(월)에 한 번만 판정**. 규칙과 배포 기록은 `report/README.md`. 아래 2절.
- **발표**: 10-15 끝남(잘 끝남). 이후는 피드백 반영 + 책 추가 + 운영.

> **10-28 git 기록을 다시 썼다** (공개 저장소에서 홍보 메모·다른 사람의 말을 지우려고, `filter-branch`). GitHub에는 새 기록의 main만 있다. **`.worktrees/` 아래 옛 브랜치와 `local/pre-purge-2026-10-28`은 옛 기록이라 절대 push하지 않는다** — 지운 파일이 다시 공개된다. 새 작업은 늘 `origin/main`에서 새 브랜치로 시작하고, 옛 작업 폴더는 정리한다(아래 6번). 로컬 원본 백업: `Portfolio/backups/galpi-local-2026-10-28/`.

## 2. 지금 열려 있는 일 (우선순위 순)

1. **A/B 판정 (11-02)** — `report/README.md` 15~16줄 규칙대로: 차이 + 95% 신뢰구간, 구간이 0을 걸치면 A 유지, 표본이 한쪽 210명에 못 미쳐도 그대로 적고 "모자랐다"고 쓴다. 판정 스크립트 초안 `report/ab_final.py`는 **메인 폴더에만 있고 커밋 안 됨**(10-14 작성). 배포 시각 전후로 나눠 한 번 더 본다(같은 파일의 배포 기록 줄). **그 전까지 뒤표지(S-11)·책 정보로 가는 길·결과 화면 버튼은 바꾸지 않는다.** 그 앞 화면은 바꿔도 되고, 바꾸면 배포 시각을 `report/README.md`에 한 줄.
2. **육아·자녀 교육 주제** — 부모용 육아 책은 키워드 후보 `육아·자녀 교육`으로 **대기에 모은다**(`checks.HELD_TOPICS`, 현재 5권). 10권쯤 모이면 주제를 만든다: PRD → 질문 지도 → 예스24 분류 규칙 → 10권부터 켜짐(새 주제를 켜는 기준은 `docs/target-chips.md` 2절, 10-01·10-05에 주제를 더한 커밋 `d4bf7bc`·`77c6ce5`가 고친 파일들을 따라가면 된다 — 정확한 코드 위치는 그때 확인).
3. **키워드 후보** — 지금 목록에 없는 키워드를 AI·사용자가 `keyword_candidate`에 적은 책이 쌓인다: `저속노화`(🎯 건강·운동, 『내 몸의 생체시계를 늦추는 노화과학』), 10-29 묶음의 노트 정리법·캠핑 요리·목소리 훈련·생업 등. 같은 이름이 **5권** 모이면 키워드로 만들지 사용자에게 묻는다(이름이 조금씩 다르면 묶어서 보여 준다).
4. **피드백 남은 것** (`feedback/` 폴더): 책갈피마다 "왜 이 책인지" 보이게, 질문이 길다·하나 줄이기. 결정 전.
5. **버그 확인 못 함**: 아이폰에서 머리글·우체통 닫기 문제(WebKit 흉내로는 재현 안 됨 — 친구 아이폰이나 Amplitude로 확인), 운영에서만 나는 React #418(로컬 프로덕션 빌드에선 안 남).
6. **정리할 것**:
   - (10-28 끝남) 메인 폴더의 `feat/one-liner-rule` 커밋과 수정은 main에 합쳤고, 메인 폴더는 main이다. GitHub의 옛 브랜치는 지웠다. `docs/launch-docs` 브랜치의 문서 커밋 2개는 아직 main에 없다.
   - `.worktrees/` 아래 작업 폴더 11개 — `books-1022` 말고는 모두 main에 합쳐졌다(위 두 브랜치 제외). 지워도 되는지 사용자에게 묻고 정리.
   - `process.md`·`tasks.md`를 이 문서 기준으로 갱신하거나 "멈춤"이라고 적기.

## 3. 반복 작업 절차

### 3-1. 책 추가 ("오늘 책 추가하자")

**검수 기준의 원본은 `docs/label-dictionary.md`** (사람과 AI 태그 지시문이 같이 읽는다 — 0~5절은 지시문에 그대로 들어감). `docs/review-guide.md`는 검수 페이지에서 카드를 보는 순서·버튼 뜻을 정리한 **사람용 안내**인데 10-06에 멈춰 있다 — 판단이 다르면 정의서가 맞다. 사용자가 검수 중 "이 책 넣어야 해?"라고 물으면 정의서의 해당 절을 찾아 근거와 함께 답하고, 규칙이 없거나 애매하면 **넣는 것 / 빼는 것 / 예시**를 붙인 규칙안을 내고 승인받아 버전을 올린다(아래 3-1-1처럼).

작업 폴더는 `.worktrees/books-1022`를 계속 쓴다(`.env`와 예스24 캐시 `data/raw/`가 들어 있음 — 새 폴더를 만들면 둘 다 복사해야 한다).

```
cd .worktrees/books-1022
git fetch origin && git switch -c books/<날짜> origin/main
PYTHONIOENCODING=utf-8 python -m src.pipeline.run_daily --date <날짜>        # 기본 100권, 30~40분, 약 $3.5 — 백그라운드로
PYTHONIOENCODING=utf-8 python -m src.pipeline.review <날짜>                  # 검수 페이지 → 메인 폴더 data/processed/check/pipeline/<날짜>.html
```
- 결과(후보·넣기·검수·대기·빠짐·다른 갈래·비용)를 표로 보고하고 검수 페이지를 브라우저 창에 띄운다.
- 사용자가 검수 → `~/Downloads/<날짜>-review.json`을 내려받는다 → `python -m src.pipeline.review <날짜> --apply <파일>`.
- **답이 없는 책**(확인을 안 누른 책)은 review/reserve로 남는다 — 사용자에게 묻거나, 사용자가 대화에서 이미 정한 책은 그 답으로 작은 답 파일을 만들어 `--apply`(형식은 내려받은 파일과 같다: `{"file": "<날짜>", "answers": {isbn: {...필드, "status": "dropped", "ok": true}}}`).
- `cd web && npm run books:import` → 서재 권수 확인.
- **소식통** `web/src/data/news.json`: 그 주(월~일)에 새 책 줄은 **한 줄만** — "새 책 N권이 꽂혀 갈피의 서재가 M권이 됐어요". 같은 주에 또 넣으면 그 줄 숫자를 고친다. 새 주면 맨 위에 새 칸.
- `docs/context.md`에 날짜 행 하나(결과 숫자 + 그날 정한 규칙).
- 테스트: `PYTHONIOENCODING=utf-8 python -m pytest src/tests -q`, `cd web && npx vitest run` → 커밋(영어 메시지, 끝에 `Co-Authored-By` 줄, 본문에 events 체크리스트 줄).
- 같은 날 더 받고 싶으면 `--batch <날짜>-2 --count 50`.

#### 3-1-1. 최근 정의서 변경 (검수에서 사용자가 정한 것 — 비슷한 책이 오면 이것부터)

| 버전 | 날짜 | 규칙 (정의서 위치) | 계기가 된 책 |
|---|---|---|---|
| v3.6 | 10-20 | 육아·자녀 교육은 주제가 없어 후보 이름 `육아·자녀 교육`으로 **대기**(부모용만, 교사용 지도서는 빼기) · 시리즈는 1권만 · 19금 빼기 (3절 1-1, 2절) | 66일 자존감 대화법 |
| v3.7 | 10-22 | **만화** = 칸 만화는 빼기, 그림이 곁들여진 글은 같은 기준. 소개가 웹툰·만화·툰이라 부르는데 AI가 넣겠다 하면 사람에게(`checks.hold_comic`) (0절) | 알고 싶니 마음, 심리툰 |
| v3.8 | 10-22 | **놀이·활동책** 빼기(부모용이어도 육아 대기 아님) (0절) | 문해력 놀이 30 |
| v3.9 | 10-25 | **고전 소설**은 신선·귀신이 나와도 작가 나라로 한국·외국 소설, 초자연은 세계 축 (2절 경계) | 구운몽 |
| v3.10 | 10-25 | **정치 논쟁서** 빼기 — 어느 진영이든 똑같이 (0절) | 반일 종족의 역사 내란 |
| v3.11 | 10-27 | 번호 없어도 소개가 **후속작·속편**이라 부르면 빼기 (2절 시리즈) | 도로시 죽이기 |
| v3.12 | 10-29 | 예외: **권마다 이야기가 따로 끝나는 시리즈**(단편 모음, 사건이 끝나는 추리 시리즈)는 번호 상관없이 같은 기준 (2절 시리즈) | SF 보다 Vol.2, 팔묘촌 |
| v3.13 | 10-29 | **한 직업만 쓰는 직무 실무서** 빼기(사회복지사·교사·간호사·공무원 서식·기록) (3절 1) | AI 사회복지 글쓰기 |

코드로 거르는 것(정의서와 함께): `checks.HELD_TOPICS`(육아 대기), `hold_comic`(만화 단어), `hold_same_book`(서재 책과 첫 저자·쪽수·제목이 겹치면 "같은 책 다른 판?"으로 사람에게 — 10-27). 그 밖에 사용자가 검수에서 뺀 유형: 질병 관리 지침서(정의서 3절 건강·운동 "의학 전문서·질병 치료서"), 입시용 학생 독서 포트폴리오(수험서·어린이 책).

**주의**
- 옛 묶음(다른 날짜)에 `--apply`로 빼기를 반영하면 `data/pipeline/agreement.csv`에 그 묶음 줄이 **새로 생긴다**(결정 1건으로 계산된 엉터리 통계) — 마지막 줄을 지운다.
- 검수 중 사용자가 새 규칙을 정하면: 정의서 버전을 올리고(`버전 vX.Y` 머리줄 + 8절 바뀐 기록 행) `src/tests/test_pipeline_tagger.py`의 버전 테스트와 "지시문에 들어갔나" 테스트를 고친다. 코드 규칙이면 `src/pipeline/checks.py`에 테스트 먼저.

### 3-2. 배포 ("배포해줘"라고 할 때만)

```
# report/README.md A/B 기록에 마지막 배포 줄 아래 한 줄: "- **MM-DD HH:MM KST 배포** (A·B 공통): 무엇 — 화면에 무엇이 바뀌나"
git add report/README.md && git commit -m "docs(report): log the ... deploy time"
git fetch origin && git switch main && git merge --ff-only origin/main
git merge --no-ff <브랜치> -m "Merge <브랜치>: ..." && git push origin main && git switch <브랜치>
```
그다음 `curl -s https://www.galpibook.com/ | grep "<새 서재 권수>"`가 나올 때까지(1~3분) 확인하고 보고한다. 화면이 바뀌는 배포면 news.json 한 줄을 같은 커밋에(규칙 6).

### 3-3. 매일 아침 숫자 확인

`check/daily.md`(메인 폴더, 커밋 안 함)의 SQL 5개를 사용자가 Supabase SQL Editor에서 하나씩 돌린다: 일별·주간 사용자, A/B 현황, 소식통·우체통, 로그인. 결과를 붙여 주면 해석한다. 자세한 점검은 `check/supabase-checks.md`. 내 기기 3대(익명 번호)는 두 파일 안에 있고 늘 뺀다. **A/B 숫자를 보고 실험을 멈추거나 판단하지 않는다.**

## 4. 사용자와 일하는 방식 (대화에서 굳어진 것)

- 한국어로, 쉬운 말로. **번호 매긴 선택지만 던지면 헷갈려 한다**("1이랑 2가 뭔데") — 선택지는 내용으로 부르고, 추천을 먼저 말한다.
- 디자인은 **시안을 만들어 나란히 보여 주고** 고르게 한다(`docs/mockups/날짜-이름.html`).
- 사용자가 붙여 넣는 "조언 글"(다른 AI 답 등)은 **사실인지 데이터로 확인**하고 답한다(예: 같은 책 다른 판 → 목차 비교로 확인).
- 규칙을 정할 때는 **경계(넣는 것 / 빼는 것)와 예시**를 같이 제안하고, 진영·장르에 치우치지 않게("어느 쪽이든 똑같이").
- 사용자가 고친 결정은 바로 기록(`context.md`, 정의서 바뀐 기록).
- 할 일을 줄 때는 무엇을·몇 개·어떤 규격으로·어느 폴더에.

### 저장소 밖 메모에만 있던 규칙 (여기로 옮김)

- **모든 장르를 전제로 설계한다** (10-04): 지금 0권인 장르·주제도 질문 지도·검증·뽑기에서 늘 있는 것으로 다룬다. "책이 없으니 빼자"는 제안은 하지 않는다 — 모자란 곳은 뽑기에서 넓혀 채우고 책 추가가 채운다.
- **소식통 규칙** = `CLAUDE.md` 원칙 6 (새 책 줄은 주마다 한 줄).

## 5. 하지 않는 것

- API 키 값 출력·대화에 쓰기. `.env` 키 이름: `DATA4LIBRARY_KEY`, `KAKAO_REST_KEY`, `YES24_API_KEY`, `STITCH_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` (값은 사용자 `.env`에만).
- 예스24 책소개·목차·표지를 커밋하거나 공개 주소에 올리기 (`data/raw/`는 git에 안 들어감).
- "배포해줘" 없이 main에 push. 로그인·가입·콘솔 설정·키 발급은 사용자가 직접.
- **커밋하지 않는 것**: `presentation/`, `web/src/app/catalog-tmp/`, `web/shot-tmp.mjs`, `web/shots-tmp/`, `.claude/`, `kakao-app-icon-512.png`, `check/`, `report/ab_final.py`(판정 전까지), `test-results/`.
- 진행 중인 A/B 내용을 소식통에 쓰기.

## 6. 저장소 밖에 있는 것

| 무엇 | 어디 |
|---|---|
| 피드백 원문·홍보 기록 | `feedback/2026-10-12-01.md`, `feedback/2026-10-13-01.md`, **`marketing/`의 채널별 폴더 전부**(올린 글·사진, README만 공개), `docs/threads-plan.md`·`threads-tracker.xlsx` — 다른 사람의 말과 홍보 계정 운영 메모라 **공개 저장소에서 기록까지 지움(10-28)**, 이 컴퓨터에만. `.gitignore`에 있음 |
| 매일 확인 SQL | `Galpi/check/daily.md`, `check/supabase-checks.md` (커밋 안 함) |
| 발표 자료 | `Galpi/presentation/` (HTML 장표 `deck-site/` → Vercel `galpi-deck`, noindex), Canva 디자인(사용자 계정) |
| 발표용 스킬 | GitHub `JunheePark0224/canva-deck-skill` (공개, Claude Code 플러그인) + 이 PC `~/.claude/skills/canva-deck` |
| 검수 페이지 | 메인 폴더 `data/processed/check/pipeline/*.html` (예스24 글이 들어 있어 커밋 안 함) |
| 블로그 | 티스토리 juny-data.tistory.com (구글 색인됨), Search Console에서 galpibook.com 노출 시작(10-28, 클릭 0) |
| 서비스 계정 | Supabase(DB·로그인), Vercel(배포), Amplitude(이벤트), Google Search Console — 모두 사용자 로그인 |

## 7. 문서 지도

`CLAUDE.md`(원칙) · `docs/README.md`(문서 관계) · `PRD.md`(기능 F-xx, 화면 S-xx, 이벤트 E-xx) · `DESIGN.md`(토큰 T-xx, 컴포넌트 C-xx) · `taxonomy.md`(이벤트 원본, v2.8) · `label-dictionary.md`(태그 기준 v3.11) · `book-pool.md`(수집·뽑기 규칙) · `context.md`(결정 기록) · `report/README.md`(A/B) · `docs/stitch/`(Stitch 시안 — `src/fetch_stitch.py`로 읽어 옴) · **`playbook.md`(이 프로젝트의 설계·운영 방식 — 다음 프로젝트용 설명서)**.
