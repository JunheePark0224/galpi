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
  - 기분: `temp=+1|-1`, `way=개념|실습`, `len=+1|-1`
  - 모드: `mode=normal|challenge`
- `next=`는 다음 질문의 `id`. 마지막 질문은 `next=draw`로 책 뽑기에 들어간다.
- 기분(`mood`) 노드는 범위를 바꾸지 않는다. 범위 효과는 `narrow` 노드에서만 쓴다.
- `far` 블록은 도전 길에서 쓰는 규칙으로, `from:`(지금 범위)과 `to:`(멀리 건너갈 범위)를 한 줄씩 쓴다.
- `far` 규칙은 위에서부터 맞춰 보고 **첫 규칙이 이긴다 — 좁은 규칙을 위에** 쓴다. 위 규칙이 아래 규칙을 다 덮으면(아래 규칙이 영영 쓰이지 않으면) 검사가 실패한다.
- 맞는 `far` 규칙이 없으면 반대 갈래 전체(이야기 ↔ 배우기)로 가고, 갈래를 고르지 않았으면(전체) 뒤집을 것이 없어 전체 그대로다.
- 검사(`validateMap`)가 모든 `next`, 장르·주제·키워드 이름이 우리 데이터에 있는지 확인하고, 하나라도 틀리면 빌드가 실패한다.

> 임시 시작 지도 — 계획 1 Task 8에서 사람이 확정한 초안으로 바꾼다

```node
id: start
kind: narrow
question: 오늘은 어느 쪽으로 갈까요?
A: 평소 끌리는 쪽으로 | mode=normal | next=branch
B: 오늘은 낯선 쪽으로 도전 | mode=challenge | next=branch
unsure: next=branch
```

```node
id: branch
kind: narrow
question: 무엇이 더 끌려요?
A: 이야기에 빠지기 | entry=leaf | next=story-world
B: 뭔가 배우기 | entry=target | next=learn-area
unsure: next=mood-len
```

```node
id: story-world
kind: narrow
question: 어디가 더 끌려요?
A: 지금 여기 | genres=한국 소설,외국 소설,에세이 | next=mood-temp
B: 딴 세상 | genres=SF·판타지 | next=mood-temp
unsure: next=mood-temp
```

```node
id: learn-area
kind: narrow
question: 어떤 걸 더 배우고 싶어요?
A: 데이터를 다루기 | topics=데이터 분석 | next=learn-data
B: 마음을 돌보기 | topics=마음 돌보기 | next=mood-way
unsure: next=mood-way
```

```node
id: learn-data
kind: narrow
question: 어떤 쪽이 더 끌려요?
A: DB에서 꺼내기 | keywords=SQL | next=mood-way
B: 표로 정리하기 | keywords=엑셀 | next=mood-way
unsure: next=mood-way
```

```node
id: mood-temp
kind: mood
question: 어떤 이야기가 좋아요?
A: 따뜻한 이야기 | temp=+1 | next=mood-len
B: 여운이 남는 이야기 | temp=-1 | next=mood-len
unsure: next=mood-len
```

```node
id: mood-way
kind: mood
question: 어떻게 배우고 싶어요?
A: 원리부터 차근차근 | way=개념 | next=mood-len
B: 바로 따라 하기 | way=실습 | next=mood-len
unsure: next=mood-len
```

```node
id: mood-len
kind: mood
question: 얼마나 읽고 싶어요?
A: 가볍게 한 권 | len=+1 | next=draw
B: 깊게 파고들기 | len=-1 | next=draw
unsure: next=draw
```

```far
from: entry=target | topics=데이터 분석
to: entry=leaf | genres=에세이
```
