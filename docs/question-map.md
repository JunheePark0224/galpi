# 질문 지도

갈피 v2의 질문 길을 정하는 문서. 이 문서가 원본이고, `web/src/data/question-map.json`은 `npm run map:build`로 여기서 만든 결과다. 문서를 고치면 다시 빌드해서 함께 커밋한다.

## 형식

- 블록은 두 종류다. `node` 블록은 질문 하나, `far` 블록은 "멀리 가기" 규칙 하나.
- 블록은 코드 펜스(`node` 또는 `far`)로 감싸고, 안에는 `키: 값` 줄을 쓴다.
- 첫 번째 `node` 블록이 시작 질문이다.
- `node` 키: `id`, `kind`(`narrow` = 범위를 좁히는 질문, `mood` = 기분 질문), `question`, 선택지 `A`, `B`, 그리고 `unsure`(잘 모르겠어요).
- 선택지는 늘 둘(A, B)이고, `unsure`는 따로 하나. 선택지 줄은 `이름 | 효과 | 효과 ... | next=다음` 모양이다.
- 효과 목록:
  - 범위(좁히는 질문에서만): `entry=leaf|target`, `genres=a,b`, `topics=a,b`, `keywords=a,b`
  - 기분: `temp=+1|-1`, `way=개념|실습|사례`(쉼표로 여럿 — 그중 하나면 +2점), `len=+1|-1`
  - 모드: `mode=normal|challenge`
- `next=`는 다음 질문의 `id`. 마지막 질문은 `next=draw`로 책 뽑기에 들어간다.
- 기분(`mood`) 노드는 범위를 바꾸지 않는다. 범위 효과는 `narrow` 노드에서만 쓴다.
- `far` 블록은 도전 길에서 쓰는 규칙으로, `from:`(지금 범위)과 `to:`(멀리 건너갈 범위)를 한 줄씩 쓴다. 블록 바로 위 줄 `N. 제목`이 규칙 번호와 이름이다 — 번호는 규칙마다 하나(겹치면 빌드 실패)이고 **규칙에 붙어 다닌다** — 새 규칙은 번호를 이어서 매기고(10-05: 37~43), 자리는 아래 "첫 규칙이 이긴다"에 맞춰 위쪽에 둘 수 있다. 그래서 문서 순서와 번호 순서가 다를 수 있다(기록된 E-07 `challenge_rule`의 뜻이 바뀌지 않게). 이름은 뽑기 응답의 도전 근거(`challenge.rule`)에 그대로 실린다.
- `far` 규칙은 위에서부터 맞춰 보고 **첫 규칙이 이긴다 — 좁은 규칙을 위에** 쓴다. 위 규칙이 아래 규칙을 다 덮으면(아래 규칙이 영영 쓰이지 않으면) 검사가 실패한다.
- **도전 규칙 v2 (10-05, 사용자 확정 — `plans/2026-10-05-challenge-rules.md`)**: 도전은 고른 큰 목적(이야기 / 배우기) 안에서 한 발짝 옮긴다. **반대 갈래로 건너가는 대체 규칙은 없다** — 이야기는 목록 규칙 19가, 배우기는 목록 규칙 36이 갈래마다 맨 아래에서 모든 범위를 받는다(데이터 테스트가 도전 길 끝마다 규칙이 있는지 확인). **배우기 도전(`from: entry=target …`)의 `to`는 과학 교양·인문·역사·예술·여행·사회·시사만**(코드의 `LEARN_CHALLENGE_GENRES`, 검사가 실패시킴) — 시·에세이·한국 소설·외국 소설·로맨스·SF·판타지·추리·스릴러·호러·괴담으로 가지 않는다. 배우기 도전은 넓히기·운명 1장도 이 다섯 장르 안에서. 이야기 도전은 넓히면 이야기 전체까지(전과 같음). 갈래를 고르지 않았으면(섞어서) 이야기·배우기 중 하나를 뽑기 시드로 고른 뒤 그 갈래의 규칙(19 또는 36).
- **도전 목록 `pick: one`**: `far` 블록에 `pick: one`을 쓰면 `to:`의 `genres`가 목록이 되고, 뽑기마다 그중 **한 장르**에서 뽑는다 — 지금 책(카탈로그 전체)이 **5권 이상**(`LIST_MIN_BOOKS`)인 장르만 후보, 후보끼리 **같은 확률**, 뽑기 시드로(같은 시드 → 같은 장르). 그 한 장르에서 평소처럼 넓힌다. 5권인 장르가 하나도 없으면 목록 전체를 한 범위로. 책이 늘면 지도를 고치지 않아도 후보가 는다. **사용자의 과거(꽂은 책·이전 길)는 보지 않는다**(사용자 결정). 시드가 없는 곳(기분 질문 건너뛰기 표, `map:coverage`, E-34 `scope_id`)에서는 목록 전체를 범위로 본다.
- **`why:`** = 규칙의 "이동의 뜻" 한 줄 **초안**(사람이 씀, 데이터). 뽑기 응답 `challenge.reasonDraft`로 실리지만 **화면에는 쓰지 않는다** — 사용자가 실제 결과를 보고 나중에 다듬는다(10-05). 이야기 규칙 1~19에는 아직 없다(`null`). 로맨스 규칙 37에는 있다(10-05 계획에 이동의 뜻이 함께 왔다).
- 배우기 도전은 🍃 책(과학 교양·인문 …)으로 가므로 방식 답은 이야기 축 하나로 옮겨 점수를 준다: 개념 → 알게 됨, 실습 → 현실, 사례 → 몰입(10-05, `balance-game.md`).
- **기분 질문을 넘기는 자리**(10-05, 설계 5-2): 그 자리에서 두 답이 각각 1권 이상 점수를 주는 책이 없으면 "못 잡겠어요"처럼 넘긴다(화면에 안 나옴). 어디서 넘기는지는 책에 따라 바뀌므로 지도가 아니라 `web/src/data/mood-skips.json`(`npm run map:build`·`books:import`가 다시 만듦)에 있다. 그래서 같은 질문도 범위에 따라 나오기도, 안 나오기도 한다.
- 검사(`validateMap`)가 모든 `next`, 장르·주제·키워드 이름이 우리 데이터에 있는지(장르는 `MAP_GENRES` = 🍃 13개 + 🎯 주제 — 아직 책이 없는 장르도 된다) 확인하고, 하나라도 틀리면 빌드가 실패한다.

## 지도 v1 초안 (10-04, 사용자 검토 전)

> **초안** — 질문 문장·갈림·먼 곳 표는 사용자가 읽고 고친 뒤 확정한다(계획 1 Task 8). 확정 전에는 계획 2를 시작하지 않는다.

한눈에 보기:

- **처음**: 평소 / 도전 → 이야기 / 배우기 (못 잡겠어요 = 섞어서 분량 질문 하나) → 갈래 초입 "떠오르는 게 있어요 / 기분 따라 갈래요"
- **이야기 좁히기**: 책장(소설 / 진짜 세상) → 묶음 → 장르. 좁히기가 끝나거나 못 잡겠어요면 기분 질문 `story-temp`(온도) → `story-pull`(끌림) → `story-len`(분량)
- **이야기 기분 따라**: `story-gain`(얻는 것) → `story-world`(세계) → 온도 → 끌림 → 분량 (다섯 개 — `balance-game.md` 1·2·3·4·9번 문장에서)
- **배우기 좁히기**: 일을 더 잘하기(데이터·AI·커리어·글쓰기·시간·마케팅·리더십) / 나를 더 잘 돌보기(습관·돈·경제·마음·관계·건강·요리) → 분야 → 주제 → 키워드(셋 이상이면 두 단계). 끝나면 `learn-way`(방식: 개념 / 써먹기 = 실습·사례 → 실습 / 사례) → `learn-len`(분량: 얇은 책 ≤280쪽 / 두툼한 책 ≥380쪽)
- **먼 곳 표**: 장르·주제 하나짜리 규칙이 위, 묶음 규칙이 아래. **이야기 길은 늘 이야기 장르 안에서 뒤집는다**(10-04 사용자 결정 — 🍃 → 🎯 규칙 없음, 장르를 고르지 않은 이야기 길도 마지막 `entry=leaf` 규칙이 받는다). 배우기 도전은 배움의 확장 영역(과학 교양·인문·역사·예술·여행·사회·시사)으로만, 주제를 고르지 않은 배우기 길은 마지막 규칙 36(도전 목록)이 받는다(10-05 v2)
- **모든 장르가 있다고 본다**(10-04 사용자 결정): 검사의 장르 목록은 `MAP_GENRES`(🍃 13개 + 🎯 주제) — 책이 0권인 역사·사회·시사·호러·괴담·로맨스(10-05)와 새 주제 넷도 길이 있고, coverage에 0권으로 나온다(뽑기는 윗단계로 넓혀 채움)

### 처음

```node
id: start
kind: narrow
question: 오늘은 어느 쪽으로 걸어 볼까요?
A: 평소 끌리는 쪽으로 | mode=normal | next=branch
B: 오늘은 낯선 쪽으로 도전 | mode=challenge | next=branch
unsure: next=branch
```

```node
id: branch
kind: narrow
question: 지금 더 끌리는 건 어느 쪽이에요?
A: 이야기에 빠지기 | entry=leaf | next=story-intro
B: 뭔가 배우기 | entry=target | next=learn-intro
unsure: next=mix-len
```

```node
id: mix-len
kind: mood
question: 오늘은 어떤 책이 손에 잡힐까요?
A: 가볍게 얇은 책 | len=+1 | next=draw
B: 든든하게 두꺼운 책 | len=-1 | next=draw
unsure: next=draw
```

### 이야기 — 초입

```node
id: story-intro
kind: narrow
question: 읽고 싶은 이야기가 떠올라요?
A: 떠오르는 게 있어요 | next=story-shelf
B: 기분 따라 갈래요 | next=story-gain
unsure: next=story-gain
```

### 이야기 — 좁히기

```node
id: story-shelf
kind: narrow
question: 어떤 책장 앞에 서 볼까요?
A: 소설 속으로 | genres=한국 소설,외국 소설,SF·판타지,추리·스릴러,호러·괴담,로맨스 | next=story-fiction
B: 진짜 세상 이야기 | genres=에세이,시,인문,과학 교양,예술·여행,역사,사회·시사 | next=story-nonfiction
unsure: next=story-gain
```

```node
id: story-fiction
kind: narrow
question: 소설이라면 어느 쪽이에요?
A: 현실에 발 딛은 소설 | genres=한국 소설,외국 소설,로맨스 | next=story-real
B: 장르의 짜릿함 | genres=SF·판타지,추리·스릴러,호러·괴담 | next=story-genre
unsure: next=story-temp
```

`story-real`(10-05, `plans/2026-10-05-new-genres.md`): 선택지 문구는 계획 그대로, 질문 문장은 **초안**(사용자 확인 대기).

```node
id: story-real
kind: narrow
question: 어떤 이야기에 마음이 가요?
A: 설레는 사랑 이야기 | genres=로맨스 | next=story-temp
B: 삶을 그린 소설 | genres=한국 소설,외국 소설 | next=story-novel
unsure: next=story-temp
```

```node
id: story-novel
kind: narrow
question: 어디서 온 이야기가 좋아요?
A: 우리 곁의 한국 소설 | genres=한국 소설 | next=story-temp
B: 바다 건너 외국 소설 | genres=외국 소설 | next=story-temp
unsure: next=story-temp
```

```node
id: story-genre
kind: narrow
question: 어떤 짜릿함이 끌려요?
A: 여기 없는 딴 세상 | genres=SF·판타지 | next=story-temp
B: 숨죽이는 긴장감 | genres=추리·스릴러,호러·괴담 | next=story-thrill
unsure: next=story-temp
```

```node
id: story-thrill
kind: narrow
question: 무엇에 더 숨죽여요?
A: 범인을 쫓는 추리 | genres=추리·스릴러 | next=story-temp
B: 등골 서늘한 괴담 | genres=호러·괴담 | next=story-temp
unsure: next=story-temp
```

```node
id: story-nonfiction
kind: narrow
question: 진짜 세상의 어떤 글이 좋아요?
A: 마음을 건드리는 글 | genres=에세이,시,예술·여행 | next=story-heart
B: 세상을 알아 가는 글 | genres=인문,과학 교양,역사,사회·시사 | next=story-know
unsure: next=story-temp
```

```node
id: story-heart
kind: narrow
question: 어떤 글에 기대고 싶어요?
A: 짧고 깊은 시 한 편 | genres=시 | next=story-temp
B: 천천히 읽는 산문 | genres=에세이,예술·여행 | next=story-prose
unsure: next=story-temp
```

```node
id: story-prose
kind: narrow
question: 누구의 걸음을 따라갈까요?
A: 누군가의 하루, 에세이 | genres=에세이 | next=story-temp
B: 그림·여행 따라 걷기 | genres=예술·여행 | next=story-temp
unsure: next=story-temp
```

```node
id: story-know
kind: narrow
question: 무엇을 알아 가고 싶어요?
A: 우주와 생명의 원리 | genres=과학 교양 | next=story-temp
B: 사람과 사회 이야기 | genres=인문,역사,사회·시사 | next=story-people
unsure: next=story-temp
```

```node
id: story-people
kind: narrow
question: 어느 쪽 이야기가 더 궁금해요?
A: 생각하는 법, 인문 | genres=인문 | next=story-temp
B: 지난 일과 지금 일 | genres=역사,사회·시사 | next=story-time
unsure: next=story-temp
```

```node
id: story-time
kind: narrow
question: 어느 시간이 더 궁금해요?
A: 지나간 시간, 역사 | genres=역사 | next=story-temp
B: 오늘의 사회 | genres=사회·시사 | next=story-temp
unsure: next=story-temp
```

### 이야기 — 기분

```node
id: story-gain
kind: mood
question: 다 읽고 난 나는 어떤 모습일까요?
A: 뭔가 하나 알게 된 나 | gain=+1 | next=story-world
B: 마음이 조금 달라진 나 | gain=-1 | next=story-world
unsure: next=story-world
```

```node
id: story-world
kind: mood
question: 책 속 세상은 어디가 좋아요?
A: 옆집 이야기 같은 현실 | world=+1 | next=story-temp
B: 여기 없는 딴 세상 | world=-1 | next=story-temp
unsure: next=story-temp
```

```node
id: story-temp
kind: mood
question: 책을 덮은 뒤 무엇이 남으면 좋겠어요?
A: 몽글몽글 따뜻함 | temp=+1 | next=story-pull
B: 한동안 멍한 여운 | temp=-1 | next=story-pull
unsure: next=story-pull
```

```node
id: story-pull
kind: mood
question: 딱 하나만 가질 수 있다면요?
A: 밑줄 긋고 싶은 문장 | pull=+1 | next=story-len
B: 다음 장이 궁금한 밤 | pull=-1 | next=story-len
unsure: next=story-len
```

```node
id: story-len
kind: mood
question: 오늘 가방에 넣을 책은요?
A: 쏙 들어가는 얇은 책 | len=+1 | next=draw
B: 든든하게 두꺼운 책 | len=-1 | next=draw
unsure: next=draw
```

### 배우기 — 초입

```node
id: learn-intro
kind: narrow
question: 배우고 싶은 게 떠올라요?
A: 떠오르는 게 있어요 | next=learn-area
B: 기분 따라 갈래요 | next=learn-way
unsure: next=learn-way
```

### 배우기 — 큰 갈래

```node
id: learn-area
kind: narrow
question: 어떤 걸 배우고 싶어요?
A: 일을 더 잘하기 | topics=데이터 분석,통계,AI 활용,업무 자동화,취업·커리어,글쓰기,시간·생산성,마케팅·브랜딩,리더십 | next=learn-work
B: 나를 더 잘 돌보기 | topics=습관·집중,돈 관리·투자,경제 상식,마음 돌보기,대화·관계,건강·운동,요리·살림 | next=learn-life
unsure: next=learn-way
```

```node
id: learn-work
kind: narrow
question: 일에서 무엇을 키우고 싶어요?
A: 숫자·도구 다루기 | topics=데이터 분석,통계,AI 활용,업무 자동화 | next=learn-tools
B: 일하는 방식과 사람 | topics=취업·커리어,글쓰기,시간·생산성,마케팅·브랜딩,리더십 | next=learn-craft-people
unsure: next=learn-way
```

`learn-craft-people` · `learn-reach`(10-05, `plans/2026-10-05-new-genres.md`): 선택지 문구는 계획 그대로, 질문 문장은 **초안**(사용자 확인 대기).

```node
id: learn-craft-people
kind: narrow
question: 일하는 방식의 어느 쪽을 키울까요?
A: 나를 다듬기 | topics=취업·커리어,글쓰기,시간·생산성 | next=learn-craft
B: 함께 움직이기 | topics=마케팅·브랜딩,리더십 | next=learn-reach
unsure: next=learn-way
```

```node
id: learn-reach
kind: narrow
question: 누구와 어떻게 움직이고 싶어요?
A: 알리고 팔기 | topics=마케팅·브랜딩 | next=learn-market
B: 사람을 이끌기 | topics=리더십 | next=learn-lead
unsure: next=learn-way
```

```node
id: learn-tools
kind: narrow
question: 어떤 도구가 더 끌려요?
A: 데이터 읽고 분석 | topics=데이터 분석,통계 | next=learn-data-field
B: AI로 일하기 | topics=AI 활용,업무 자동화 | next=learn-ai-field
unsure: next=learn-way
```

```node
id: learn-craft
kind: narrow
question: 어느 쪽을 다듬고 싶어요?
A: 시간과 일하는 법 | topics=시간·생산성 | next=learn-time
B: 커리어와 글 | topics=취업·커리어,글쓰기 | next=learn-career-field
unsure: next=learn-way
```

### 배우기 — 시간·생산성

```node
id: learn-time
kind: narrow
question: 시간과 일, 어디가 궁금해요?
A: 일 잘하는 법 콕 | keywords=일하는 법 | next=learn-way
B: 시간·기록 두루 | topics=시간·생산성 | next=learn-way
unsure: next=learn-way
```

### 배우기 — 큰 갈래

```node
id: learn-life
kind: narrow
question: 무엇을 돌보고 싶어요?
A: 마음과 관계 | topics=마음 돌보기,대화·관계 | next=learn-mind-field
B: 하루와 살림 | topics=습관·집중,돈 관리·투자,경제 상식,건강·운동,요리·살림 | next=learn-daily-body
unsure: next=learn-way
```

`learn-daily-body` · `learn-body`(10-05, `plans/2026-10-05-new-genres.md`): 선택지 문구는 계획 그대로, 질문 문장은 **초안**(사용자 확인 대기).

```node
id: learn-daily-body
kind: narrow
question: 하루의 어느 쪽을 돌볼까요?
A: 몸과 생활 | topics=건강·운동,요리·살림 | next=learn-body
B: 습관과 돈 | topics=습관·집중,돈 관리·투자,경제 상식 | next=learn-daily
unsure: next=learn-way
```

```node
id: learn-body
kind: narrow
question: 무엇부터 챙길까요?
A: 몸 움직이기 | topics=건강·운동 | next=learn-health
B: 밥과 살림 | topics=요리·살림 | next=learn-home
unsure: next=learn-way
```

```node
id: learn-daily
kind: narrow
question: 어느 쪽을 바꾸고 싶어요?
A: 습관과 집중 | topics=습관·집중 | next=learn-habit
B: 돈과 경제 | topics=돈 관리·투자,경제 상식 | next=learn-money-field
unsure: next=learn-way
```

### 배우기 — 데이터·통계

```node
id: learn-data-field
kind: narrow
question: 데이터의 어느 쪽이 끌려요?
A: 데이터 꺼내는 도구 | topics=데이터 분석 | keywords=SQL,엑셀,파이썬 | next=learn-data-tool
B: 숫자를 읽는 눈 | topics=데이터 분석,통계 | next=learn-data-read
unsure: next=learn-way
```

```node
id: learn-data-tool
kind: narrow
question: 어떤 쪽이 더 끌려요?
A: DB에서 꺼내기 | keywords=SQL | next=learn-way
B: 표·코드로 분석 | keywords=엑셀,파이썬 | next=learn-data-sheet
unsure: next=learn-way
```

```node
id: learn-data-sheet
kind: narrow
question: 무엇으로 분석해 볼까요?
A: 표로 (엑셀) | keywords=엑셀 | next=learn-way
B: 코드로 (파이썬) | keywords=파이썬 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-data-read
kind: narrow
question: 숫자를 어떻게 읽고 싶어요?
A: 데이터로 말하기 | topics=데이터 분석 | keywords=데이터 리터러시 | next=learn-way
B: 통계로 따져 보기 | topics=통계 | next=learn-stats
unsure: next=learn-way
```

```node
id: learn-stats
kind: narrow
question: 통계, 어디부터 볼까요?
A: 기초부터 다지기 | keywords=기초 통계,확률 | next=learn-stats-base
B: 분석 기법 익히기 | keywords=회귀분석,가설검정 | next=learn-stats-method
unsure: next=learn-way
```

```node
id: learn-stats-base
kind: narrow
question: 어느 쪽이 더 궁금해요?
A: 평균·분포 읽기 | keywords=기초 통계 | next=learn-way
B: 확률로 생각하기 | keywords=확률 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-stats-method
kind: narrow
question: 어떤 질문에 답하고 싶어요?
A: 관계를 찾는 회귀 | keywords=회귀분석 | next=learn-way
B: 차이를 따지는 검정 | keywords=가설검정 | next=learn-way
unsure: next=learn-way
```

### 배우기 — AI·IT

```node
id: learn-ai-field
kind: narrow
question: AI와 어떻게 만나고 싶어요?
A: AI 똑똑하게 쓰기 | topics=AI 활용 | next=learn-ai
B: AI로 업무 줄이기 | topics=업무 자동화 | next=learn-auto
unsure: next=learn-way
```

```node
id: learn-ai
kind: narrow
question: AI로 무엇을 하고 싶어요?
A: AI와 잘 대화하기 | keywords=챗GPT,클로드,제미나이,프롬프트 엔지니어링 | next=learn-ai-chat
B: 만들고 파고들기 | keywords=바이브 코딩,AI 에이전트,이미지·영상 생성,LLM 원리 | next=learn-ai-make
unsure: next=learn-way
```

```node
id: learn-ai-chat
kind: narrow
question: 어느 쪽이 더 끌려요?
A: AI 하나 깊게 쓰기 | keywords=챗GPT,클로드,제미나이 | next=learn-ai-tool
B: 어떤 AI든 잘 묻기 | keywords=프롬프트 엔지니어링 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-ai-tool
kind: narrow
question: 어떤 AI와 친해질까요?
A: 챗GPT | keywords=챗GPT | next=learn-way
B: 다른 AI도 궁금해요 | keywords=클로드,제미나이 | next=learn-ai-other
unsure: next=learn-way
```

```node
id: learn-ai-other
kind: narrow
question: 둘 중 누구와 먼저요?
A: 클로드 | keywords=클로드 | next=learn-way
B: 제미나이 | keywords=제미나이 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-ai-make
kind: narrow
question: AI의 어느 쪽이 궁금해요?
A: 직접 만들어 보기 | keywords=바이브 코딩,AI 에이전트,이미지·영상 생성 | next=learn-ai-create
B: AI 속 원리 알기 | keywords=LLM 원리 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-ai-create
kind: narrow
question: 무엇을 만들어 볼까요?
A: 프로그램과 AI 일꾼 | keywords=바이브 코딩,AI 에이전트 | next=learn-ai-build
B: 그림·영상 만들기 | keywords=이미지·영상 생성 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-ai-build
kind: narrow
question: 어느 쪽이 더 끌려요?
A: 말로 앱 만들기 | keywords=바이브 코딩 | next=learn-way
B: 일 맡길 AI 에이전트 | keywords=AI 에이전트 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-auto
kind: narrow
question: 무엇으로 일을 줄여 볼까요?
A: AI에게 일 맡기기 | keywords=코파일럿·M365,AI 업무 활용 | next=learn-auto-ai
B: 코드로 반복 줄이기 | keywords=파이썬 자동화 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-auto-ai
kind: narrow
question: 어떤 AI로 일할까요?
A: 오피스 속 코파일럿 | keywords=코파일럿·M365 | next=learn-way
B: 여러 AI 두루 쓰기 | keywords=AI 업무 활용 | next=learn-way
unsure: next=learn-way
```

### 배우기 — 일·커리어

```node
id: learn-career-field
kind: narrow
question: 어느 쪽을 다듬고 싶어요?
A: 일터에서 내 자리 | topics=취업·커리어 | next=learn-career
B: 글 잘 쓰기 | topics=글쓰기 | next=learn-writing
unsure: next=learn-way
```

```node
id: learn-career
kind: narrow
question: 지금 커리어 고민은요?
A: 들어가고 나오기 | keywords=자소서·면접,이직·퇴사 | next=learn-career-move
B: 지금 자리에서 크기 | keywords=커리어 설계,퍼스널 브랜딩,직장 생활 | next=learn-career-grow
unsure: next=learn-way
```

```node
id: learn-career-move
kind: narrow
question: 어느 문 앞에 서 있어요?
A: 합격하는 자소서·면접 | keywords=자소서·면접 | next=learn-way
B: 이직·퇴사 고민 | keywords=이직·퇴사 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-career-grow
kind: narrow
question: 무엇을 키우고 싶어요?
A: 회사 생활 잘하기 | keywords=직장 생활 | next=learn-way
B: 내 길 그리기 | keywords=커리어 설계,퍼스널 브랜딩 | next=learn-career-path
unsure: next=learn-way
```

```node
id: learn-career-path
kind: narrow
question: 어느 쪽이 더 끌려요?
A: 커리어 지도 그리기 | keywords=커리어 설계 | next=learn-way
B: 나를 알리기 | keywords=퍼스널 브랜딩 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-writing
kind: narrow
question: 어떤 글을 쓰고 싶어요?
A: 일하는 글 | keywords=업무 글,카피라이팅,문해력·어휘 | next=learn-writing-work
B: 나를 쓰는 글 | keywords=에세이·책 쓰기,일기·편지 | next=learn-writing-self
unsure: next=learn-way
```

```node
id: learn-writing-work
kind: narrow
question: 어디부터 다질까요?
A: 읽고 쓰는 기본기 | keywords=문해력·어휘 | next=learn-way
B: 바로 써먹는 글 | keywords=업무 글,카피라이팅 | next=learn-writing-use
unsure: next=learn-way
```

```node
id: learn-writing-use
kind: narrow
question: 어떤 글이 필요해요?
A: 보고서·메일 | keywords=업무 글 | next=learn-way
B: 마음을 끄는 카피 | keywords=카피라이팅 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-writing-self
kind: narrow
question: 어디에 쓰고 싶어요?
A: 책 한 권 내기 | keywords=에세이·책 쓰기 | next=learn-way
B: 일기·편지에 | keywords=일기·편지 | next=learn-way
unsure: next=learn-way
```

### 배우기 — 습관·집중

```node
id: learn-habit
kind: narrow
question: 어느 쪽이 더 끌려요?
A: 습관·집중 고치기 | keywords=습관,집중력 | next=learn-habit-fix
B: 뇌가 움직이는 원리 | keywords=뇌과학 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-habit-fix
kind: narrow
question: 무엇부터 고칠까요?
A: 좋은 습관 들이기 | keywords=습관 | next=learn-way
B: 한 가지에 몰입 | keywords=집중력 | next=learn-way
unsure: next=learn-way
```

### 배우기 — 돈·경제

```node
id: learn-money-field
kind: narrow
question: 돈의 어느 쪽이 궁금해요?
A: 내 돈 굴리기 | topics=돈 관리·투자 | next=learn-money
B: 경제 흐름 읽기 | topics=경제 상식 | next=learn-econ
unsure: next=learn-way
```

```node
id: learn-money
kind: narrow
question: 지금 돈 고민은요?
A: 투자 시작하기 | keywords=주식,ETF·펀드,부동산·청약 | next=learn-invest
B: 모으고 지키기 | keywords=재테크 기초,연금·노후,돈의 심리 | next=learn-save
unsure: next=learn-way
```

```node
id: learn-invest
kind: narrow
question: 어디에 투자해 볼까요?
A: 내 집 마련 | keywords=부동산·청약 | next=learn-way
B: 주식 시장 | keywords=주식,ETF·펀드 | next=learn-stock
unsure: next=learn-way
```

```node
id: learn-stock
kind: narrow
question: 어떻게 사 볼까요?
A: 종목 골라 사기 | keywords=주식 | next=learn-way
B: 묶어서 사기 (ETF) | keywords=ETF·펀드 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-save
kind: narrow
question: 무엇부터 챙길까요?
A: 돈 대하는 마음 | keywords=돈의 심리 | next=learn-way
B: 모으고 대비하기 | keywords=재테크 기초,연금·노후 | next=learn-save-plan
unsure: next=learn-way
```

```node
id: learn-save-plan
kind: narrow
question: 언제를 준비할까요?
A: 월급 관리 첫걸음 | keywords=재테크 기초 | next=learn-way
B: 노후 미리 준비 | keywords=연금·노후 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-econ
kind: narrow
question: 경제의 어느 쪽이 궁금해요?
A: 지금의 경제 뉴스 | keywords=금리·환율,시사·경제 이슈,트렌드 | next=learn-econ-now
B: 경제의 큰 원리 | keywords=행동경제학,경제사·자본주의 | next=learn-econ-deep
unsure: next=learn-way
```

```node
id: learn-econ-now
kind: narrow
question: 언제의 이야기가 궁금해요?
A: 다가올 트렌드 | keywords=트렌드 | next=learn-way
B: 오늘의 경제 뉴스 | keywords=금리·환율,시사·경제 이슈 | next=learn-econ-news
unsure: next=learn-way
```

```node
id: learn-econ-news
kind: narrow
question: 어느 쪽을 읽고 싶어요?
A: 금리·환율의 원리 | keywords=금리·환율 | next=learn-way
B: 경제 이슈 따라잡기 | keywords=시사·경제 이슈 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-econ-deep
kind: narrow
question: 어느 쪽이 더 끌려요?
A: 사람의 선택 심리 | keywords=행동경제학 | next=learn-way
B: 돈과 자본의 역사 | keywords=경제사·자본주의 | next=learn-way
unsure: next=learn-way
```

### 배우기 — 마음·관계

```node
id: learn-mind-field
kind: narrow
question: 누구를 돌보고 싶어요?
A: 내 마음 돌보기 | topics=마음 돌보기 | next=learn-mind
B: 사람 사이 다루기 | topics=대화·관계 | next=learn-talk
unsure: next=learn-way
```

```node
id: learn-mind
kind: narrow
question: 요즘 마음은 어때요?
A: 무거운 마음 덜기 | keywords=불안·걱정,우울,번아웃·스트레스 | next=learn-mind-heavy
B: 단단한 나 만들기 | keywords=자존감,감정 다루기,명상·마음챙김 | next=learn-mind-solid
unsure: next=learn-way
```

```node
id: learn-mind-heavy
kind: narrow
question: 어느 쪽에 더 가까워요?
A: 지쳐서 방전됐어요 | keywords=번아웃·스트레스 | next=learn-way
B: 불안하고 가라앉아요 | keywords=불안·걱정,우울 | next=learn-mind-low
unsure: next=learn-way
```

```node
id: learn-mind-low
kind: narrow
question: 어느 쪽이 더 커요?
A: 걱정이 많아요 | keywords=불안·걱정 | next=learn-way
B: 자꾸 가라앉아요 | keywords=우울 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-mind-solid
kind: narrow
question: 무엇을 키우고 싶어요?
A: 나를 믿는 힘 | keywords=자존감 | next=learn-way
B: 감정과 함께하기 | keywords=감정 다루기,명상·마음챙김 | next=learn-mind-calm
unsure: next=learn-way
```

```node
id: learn-mind-calm
kind: narrow
question: 어떻게 다독일까요?
A: 감정 다스리기 | keywords=감정 다루기 | next=learn-way
B: 명상·마음챙김 | keywords=명상·마음챙김 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-talk
kind: narrow
question: 사람 사이에서 무엇이 필요해요?
A: 말 잘하기 | keywords=말투·대화법,발표,설득·협상 | next=learn-talk-say
B: 관계 지키기 | keywords=거리 두기,갈등·무례 대처,호감·사회생활 | next=learn-talk-keep
unsure: next=learn-way
```

```node
id: learn-talk-say
kind: narrow
question: 어디서 말할 때요?
A: 여럿 앞에서 발표 | keywords=발표 | next=learn-way
B: 일대일 대화 | keywords=말투·대화법,설득·협상 | next=learn-talk-one
unsure: next=learn-way
```

```node
id: learn-talk-one
kind: narrow
question: 어떤 대화가 필요해요?
A: 편한 말투·대화법 | keywords=말투·대화법 | next=learn-way
B: 설득하고 협상하기 | keywords=설득·협상 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-talk-keep
kind: narrow
question: 어떤 관계가 고민이에요?
A: 좋은 사람 곁에 | keywords=호감·사회생활 | next=learn-way
B: 불편한 사람과 | keywords=거리 두기,갈등·무례 대처 | next=learn-talk-hard
unsure: next=learn-way
```

```node
id: learn-talk-hard
kind: narrow
question: 어떻게 대해 볼까요?
A: 적당히 거리 두기 | keywords=거리 두기 | next=learn-way
B: 무례에 맞서기 | keywords=갈등·무례 대처 | next=learn-way
unsure: next=learn-way
```

### 배우기 — 마케팅·브랜딩 · 리더십 (10-05)

키워드 셋 → 두 단계(다른 주제와 같은 모양). 질문 문장·선택지 문구 모두 **초안**(사용자 확인 대기). 키워드 책이 5권 미만이면 뽑기가 넓히기 규칙대로 주제 → 분야로 넓힌다.

```node
id: learn-market
kind: narrow
question: 알리고 파는 일, 어디부터 볼까요?
A: 브랜드와 콘텐츠 만들기 | keywords=브랜딩,콘텐츠 마케팅 | next=learn-market-make
B: 고객 마음 읽기 | keywords=고객 이해 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-market-make
kind: narrow
question: 무엇을 만들어 볼까요?
A: 기억되는 브랜드 | keywords=브랜딩 | next=learn-way
B: 사람을 모으는 콘텐츠 | keywords=콘텐츠 마케팅 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-lead
kind: narrow
question: 이끄는 일, 어디가 궁금해요?
A: 팀과 사람 이끌기 | keywords=팀 이끌기,피드백·코칭 | next=learn-lead-team
B: 일하기 좋은 조직 문화 | keywords=조직 문화 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-lead-team
kind: narrow
question: 어느 쪽이 더 필요해요?
A: 팀을 이끄는 법 | keywords=팀 이끌기 | next=learn-way
B: 피드백과 코칭 | keywords=피드백·코칭 | next=learn-way
unsure: next=learn-way
```

### 배우기 — 건강·운동 · 요리·살림 (10-05)

키워드 셋 → 두 단계. 질문 문장·선택지 문구 모두 **초안**(사용자 확인 대기).

```node
id: learn-health
kind: narrow
question: 몸의 어느 쪽을 챙길까요?
A: 운동하고 단련하기 | keywords=운동 습관,달리기·근력 | next=learn-health-move
B: 잘 자고 회복하기 | keywords=잠·회복 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-health-move
kind: narrow
question: 어떻게 움직여 볼까요?
A: 운동을 습관으로 | keywords=운동 습관 | next=learn-way
B: 달리기·근력 키우기 | keywords=달리기·근력 | next=learn-way
unsure: next=learn-way
```

```node
id: learn-home
kind: narrow
question: 집의 어느 쪽을 꾸려 볼까요?
A: 부엌에서 집밥 | keywords=집밥 | next=learn-way
B: 집 안 돌보기 | keywords=정리·미니멀,살림 기술 | next=learn-home-care
unsure: next=learn-way
```

```node
id: learn-home-care
kind: narrow
question: 무엇부터 해 볼까요?
A: 비우고 정리하기 | keywords=정리·미니멀 | next=learn-way
B: 살림 요령 익히기 | keywords=살림 기술 | next=learn-way
unsure: next=learn-way
```

### 배우기 — 기분

```node
id: learn-way
kind: mood
question: 어떻게 배우는 게 좋아요?
A: 원리부터 차근차근 | way=개념 | next=learn-len
B: 실제로 써먹는 쪽 | way=실습,사례 | next=learn-way-use
unsure: next=learn-len
```

```node
id: learn-way-use
kind: mood
question: 써먹는다면 어떻게요?
A: 바로 따라 해 보기 | way=실습 | next=learn-len
B: 남의 사례로 배우기 | way=사례 | next=learn-len
unsure: next=learn-len
```

```node
id: learn-len
kind: mood
question: 오늘은 얼마나 읽고 싶어요?
A: 가볍게 읽히는 얇은 책 | len=+1 | next=draw
B: 두툼한 책 한 권 | len=-1 | next=draw
unsure: next=draw
```

### 먼 곳 표 (도전 루트)

위에서부터 맞춰 보고 첫 규칙이 이긴다. 그래서 장르·주제 하나짜리 규칙이 위, 묶음 규칙이 아래, 고르지 않은 길을 받는 목록 규칙(19 이야기 · 36 배우기)이 갈래마다 맨 아래. 10-05에 더한 37~43(로맨스·새 주제 넷)은 번호만 이어서 매기고 자리는 같은 원칙대로 — 하나짜리 규칙 사이, 묶음 규칙 위에 둔다. 반대 갈래로 건너가는 대체 규칙은 없다(10-05 v2). 섞어서 + 도전은 시드로 한 갈래를 고른 뒤 그 갈래의 목록 규칙. 먼 곳이 모자라면 이야기 도전은 이야기 전체까지, 배우기 도전은 배움의 확장 영역(과학 교양·인문·역사·예술·여행·사회·시사)까지만 넓히고, 운명 1장도 그 안에서.

1. SF·판타지 → 에세이·시 (딴 세상 → 지금 여기의 문장, 설계 4절 예시)

```far
from: entry=leaf | genres=SF·판타지
to: entry=leaf | genres=에세이,시
```

2. 추리·스릴러 → 시·예술·여행 (다음 장이 급한 이야기 → 천천히 머무는 글)

```far
from: entry=leaf | genres=추리·스릴러
to: entry=leaf | genres=시,예술·여행
```

3. 호러·괴담 → 에세이·예술·여행 (서늘한 딴 세상 → 따뜻한 현실)

```far
from: entry=leaf | genres=호러·괴담
to: entry=leaf | genres=에세이,예술·여행
```

4. 시 → 추리·스릴러·SF (문장 → 몰입)

```far
from: entry=leaf | genres=시
to: entry=leaf | genres=추리·스릴러,SF·판타지
```

5. 에세이 → SF·판타지 (현실 → 딴 세상)

```far
from: entry=leaf | genres=에세이
to: entry=leaf | genres=SF·판타지
```

6. 예술·여행 → 추리·스릴러 (따뜻한 현실 → 서늘한 긴장)

```far
from: entry=leaf | genres=예술·여행
to: entry=leaf | genres=추리·스릴러
```

7. 과학 교양 → 시·에세이 (바깥 세계의 원리 → 마음의 문장)

```far
from: entry=leaf | genres=과학 교양
to: entry=leaf | genres=시,에세이
```

8. 인문 → SF·추리 (생각하는 글 → 빠져드는 이야기)

```far
from: entry=leaf | genres=인문
to: entry=leaf | genres=SF·판타지,추리·스릴러
```

9. 한국·외국 소설 → 과학 교양·인문 (사람 이야기 → 세상을 아는 글)

```far
from: entry=leaf | genres=한국 소설,외국 소설
to: entry=leaf | genres=과학 교양,인문
```

37. 로맨스 → SF·판타지·역사 (두 사람의 이야기 → 더 큰 세계와 시간)

```far
from: entry=leaf | genres=로맨스
to: entry=leaf | genres=SF·판타지,역사
why: 두 사람의 이야기에서 더 큰 세계와 시간으로
```

10. 숨죽이는 긴장(추리·호러) → 시·에세이·예술·여행

```far
from: entry=leaf | genres=추리·스릴러,호러·괴담
to: entry=leaf | genres=시,에세이,예술·여행
```

11. 역사·사회·시사 → SF·호러 (실제 있었던 일 → 없는 세계)

```far
from: entry=leaf | genres=역사,사회·시사
to: entry=leaf | genres=SF·판타지,호러·괴담
```

12. 산문(에세이·예술·여행) → SF·추리

```far
from: entry=leaf | genres=에세이,예술·여행
to: entry=leaf | genres=SF·판타지,추리·스릴러
```

13. 장르 소설 묶음 → 에세이·시·예술·여행

```far
from: entry=leaf | genres=SF·판타지,추리·스릴러,호러·괴담
to: entry=leaf | genres=에세이,시,예술·여행
```

14. 마음을 건드리는 글 전체 → SF·추리

```far
from: entry=leaf | genres=에세이,시,예술·여행
to: entry=leaf | genres=SF·판타지,추리·스릴러
```

15. 사람과 사회 이야기 → SF·호러

```far
from: entry=leaf | genres=인문,역사,사회·시사
to: entry=leaf | genres=SF·판타지,호러·괴담
```

16. 세상을 알아 가는 글 전체 → 소설 (아는 글 → 빠지는 이야기)

```far
from: entry=leaf | genres=인문,과학 교양,역사,사회·시사
to: entry=leaf | genres=한국 소설,외국 소설,SF·판타지
```

17. 소설 전체 → 세상을 알아 가는 글

```far
from: entry=leaf | genres=한국 소설,외국 소설,SF·판타지,추리·스릴러,호러·괴담,로맨스
to: entry=leaf | genres=인문,과학 교양,역사,사회·시사
```

18. 진짜 세상 이야기 전체 → 소설 전체

```far
from: entry=leaf | genres=에세이,시,인문,과학 교양,예술·여행,역사,사회·시사
to: entry=leaf | genres=한국 소설,외국 소설,SF·판타지,추리·스릴러,호러·괴담
```

19. 이야기 · 장르 없음 → 도전 목록

```far
from: entry=leaf
to: entry=leaf | genres=시,인문,과학 교양,예술·여행,역사,사회·시사,호러·괴담
pick: one
```

장르를 고르지 않은 이야기 길(기분 따라 · 책장에서 못 잡겠어요)을 모두 받는 이야기 길의 마지막 규칙. 목록 중 책이 5권 이상인 장르에서 같은 확률로 한 곳(10-05: 시·인문·과학 교양·예술·여행).

#### 배우기 도전 (20~36, 38~43 — 10-05 v2, 배움의 확장 영역 과학 교양·인문·역사·예술·여행·사회·시사로만)

`why:`는 "이동의 뜻" **초안**이다(사용자 10-05: 실제 결과를 보고 나중에 다듬음). 규칙의 데이터로만 두고 화면에는 아직 쓰지 않는다.

20. 마음 돌보기 → 과학 교양

```far
from: entry=target | topics=마음 돌보기
to: entry=leaf | genres=과학 교양
why: 마음을 돌보던 시선을 마음이 움직이는 원리로
```

21. 대화·관계 → 역사·인문

```far
from: entry=target | topics=대화·관계
to: entry=leaf | genres=역사,인문
why: 사람 사이의 말에서 사람이 걸어온 시간으로
```

22. 취업·커리어 → 예술·여행·인문

```far
from: entry=target | topics=취업·커리어
to: entry=leaf | genres=예술·여행,인문
why: 쓸모를 따지던 일에서 쓸모를 묻지 않는 아름다움으로
```

23. 글쓰기 → 과학 교양

```far
from: entry=target | topics=글쓰기
to: entry=leaf | genres=과학 교양
why: 문장에서 세상의 원리로
```

24. 시간·생산성 → 예술·여행·역사

```far
from: entry=target | topics=시간·생산성
to: entry=leaf | genres=예술·여행,역사
why: 효율에서 오래 머문 시간으로
```

25. 습관·집중 → 예술·여행·과학 교양

```far
from: entry=target | topics=습관·집중
to: entry=leaf | genres=예술·여행,과학 교양
why: 고치기에서 그저 바라보기로
```

38. 마케팅·브랜딩 → 예술·여행·인문

```far
from: entry=target | topics=마케팅·브랜딩
to: entry=leaf | genres=예술·여행,인문
why: 파는 말에서 쓸모를 묻지 않는 아름다움으로
```

39. 리더십 → 역사·인문

```far
from: entry=target | topics=리더십
to: entry=leaf | genres=역사,인문
why: 이끄는 법에서 사람이 걸어온 시간으로
```

40. 건강·운동 → 과학 교양

```far
from: entry=target | topics=건강·운동
to: entry=leaf | genres=과학 교양
why: 몸 쓰는 법에서 몸이 움직이는 원리로
```

41. 요리·살림 → 역사·예술·여행

```far
from: entry=target | topics=요리·살림
to: entry=leaf | genres=역사,예술·여행
why: 밥상에서 음식이 지나온 시간과 장소로
```

26. 마음과 관계 전체 → 과학 교양·역사

```far
from: entry=target | topics=마음 돌보기,대화·관계
to: entry=leaf | genres=과학 교양,역사
why: 마음과 관계에서 원리와 시간으로
```

27. 커리어와 글 → 예술·여행·과학 교양

```far
from: entry=target | topics=취업·커리어,글쓰기
to: entry=leaf | genres=예술·여행,과학 교양
why: 일과 글에서 아름다움과 원리로
```

28. 데이터·통계 → 인문·예술·여행·역사

```far
from: entry=target | topics=데이터 분석,통계
to: entry=leaf | genres=인문,예술·여행,역사
why: 숫자에서 사람과 삶으로
```

29. AI·업무 자동화 → 인문·예술·여행

```far
from: entry=target | topics=AI 활용,업무 자동화
to: entry=leaf | genres=인문,예술·여행
why: 기계의 말에서 사람의 생각으로
```

30. 돈·경제 → 인문·역사

```far
from: entry=target | topics=돈 관리·투자,경제 상식
to: entry=leaf | genres=인문,역사
why: 값을 매기는 글에서 사람과 시간을 바라보는 글로
```

42. 함께 움직이기 → 인문·역사

```far
from: entry=target | topics=마케팅·브랜딩,리더십
to: entry=leaf | genres=인문,역사
why: 알리고 이끄는 일에서 사람과 시간을 바라보는 글로
```

43. 몸과 생활 → 과학 교양·예술·여행

```far
from: entry=target | topics=건강·운동,요리·살림
to: entry=leaf | genres=과학 교양,예술·여행
why: 몸과 살림을 돌보던 손에서 원리와 아름다움으로
```

31. 일하는 방식과 사람 전체 → 예술·여행·과학 교양

```far
from: entry=target | topics=취업·커리어,글쓰기,시간·생산성,마케팅·브랜딩,리더십
to: entry=leaf | genres=예술·여행,과학 교양
why: 일하는 방식에서 아름다움과 원리로
```

32. 하루와 살림 전체 → 예술·여행·인문·역사

```far
from: entry=target | topics=습관·집중,돈 관리·투자,경제 상식,건강·운동,요리·살림
to: entry=leaf | genres=예술·여행,인문,역사
why: 하루와 살림에서 사람과 시간으로
```

33. 숫자·도구 전체 → 인문·예술·여행·역사

```far
from: entry=target | topics=데이터 분석,통계,AI 활용,업무 자동화
to: entry=leaf | genres=인문,예술·여행,역사
why: 숫자와 도구에서 사람과 삶으로
```

34. 나를 더 잘 돌보기 전체 → 과학 교양·역사

```far
from: entry=target | topics=습관·집중,돈 관리·투자,경제 상식,마음 돌보기,대화·관계,건강·운동,요리·살림
to: entry=leaf | genres=과학 교양,역사
why: 나를 돌보던 시선에서 원리와 시간으로
```

35. 일을 더 잘하기 전체 → 인문·예술·여행

```far
from: entry=target | topics=데이터 분석,통계,AI 활용,업무 자동화,취업·커리어,글쓰기,시간·생산성,마케팅·브랜딩,리더십
to: entry=leaf | genres=인문,예술·여행
why: 일을 잘하는 법에서 사람의 생각과 아름다움으로
```

36. 배우기 · 주제 없음 → 도전 목록

```far
from: entry=target
to: entry=leaf | genres=과학 교양,인문,역사,예술·여행,사회·시사
pick: one
why: 이번에는 평소와 다른 분야에서 한 발짝 나아가 봤어요
```

주제를 고르지 않은 배우기 길(기분 따라 · 못 잡겠어요)을 모두 받는 배우기 길의 마지막 규칙. 목록 중 책이 5권 이상인 장르에서 같은 확률로 한 곳(10-05: 과학 교양·인문·예술·여행). 역사·사회·시사는 책이 5권이 되면 지도를 고치지 않아도 후보가 된다.
