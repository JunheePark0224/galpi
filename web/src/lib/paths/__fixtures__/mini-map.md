# mini map (tests only)

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

1. 데이터 분석 → 인문

```far
from: entry=target | topics=데이터 분석
to: entry=leaf | genres=인문
why: 숫자에서 사람으로
```
