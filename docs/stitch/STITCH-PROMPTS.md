# Stitch 프롬프트 — 갈피

`DESIGN.md`(이 폴더, Stitch 형식)를 먼저 넣고, 아래 프롬프트를 화면마다 하나씩 붙여 넣는다.
기준 화면 크기: **모바일 390 × 844**. 화면 글자는 한국어 그대로 쓴다.

## 사용 순서 (사용자)

1. https://stitch.withgoogle.com 에서 새 프로젝트 → 모바일
2. 디자인 시스템(또는 첫 메시지)에 `docs/stitch/DESIGN.md` 내용을 붙여 넣기
3. 아래 **P-00 → P-01 → …** 순서로 프롬프트를 하나씩 붙여 넣어 화면 생성
4. 마음에 안 들면 맨 아래 **수정 프롬프트**를 이어서 붙이기
5. 끝나면 프로젝트 링크를 채팅에 주거나, 화면 이미지를 `docs/stitch/exports/`에 저장 → Claude가 수집·정리하고 **PRD와 다른 부분은 "따르지 않을 부분"으로 기록**

---

## P-00 · 책갈피 시트 (먼저 한 번)

```
Create a single reference sheet showing 6 bookmark designs side by side on cream paper (#FAF5EA) with faint ruled lines.

Each bookmark: 1:2 ratio, translucent frosted film (60% white with slight blur), top corners rounded 10px, a small punched hole near the top with a thin colored string and a knot above it, and a swallowtail V-notch at the bottom.
Under the hole, an arched window (fully rounded top) showing a small scene: a pastel sky, a soft hill, a small cute round-faced animal (cat, bear, rabbit, fox, duck, owl — flat shapes, no outlines, two black dot eyes) sitting on the hill at about half the window height, one sky prop (moon, cloud, stars, birds) and one ground prop (grass, flowers, a small stack of books, a mushroom).
Below the window: a small pill genre tag in the genre color with white text (에세이, 한국 소설, SF·판타지, 추리·스릴러, 데이터·통계, 과학 교양), a book title in Gowun Batang bold, a one-line impression in Gowun Dodum, and a dashed stitch line in the genre color. The word 갈피 very small at the bottom.
Do NOT use a rectangular card with a left vertical color strip or two horizontal color rules.
```

## P-01 · 처음 화면 (S-01)

```
Mobile home screen for "갈피", a book recommendation web app. Cream paper background.
Top right: a small text button "로그인".
Center: the logo "갈피" in Gowun Batang bold 28px, and under it the tagline "읽을 책, 갈피가 안 잡힐 때" in Gowun Dodum.
Below: an old cloth-bound book (brown #7A4A2E cover, no symbols) lying closed, with two bookmarks peeking out of its top edge.
Two large entry cards stacked vertically:
1) "알고 싶은 게 있어요" with a small subtitle "배우고 싶은 주제로, 아직 모르는 책 만나기"
2) "그냥 한 권 만나고 싶어요" with a small subtitle "밸런스 게임으로 내 취향에 맞는 한 권 만나기"
Footer caption: "정보 제공: 예스24 · 예스24와 무관한 개인 프로젝트".
Calm, warm, a little playful. One primary button at most.
```

## P-02 · 🍃 밸런스 게임 (S-02)

```
Mobile screen: a "balance game" question, step 5 of 9.
Top: a thin progress bar with 9 segments (5 filled in ink, 1 of them lighter meaning skipped).
Small kicker text "비 오는 날 창가에서", big question "펼칠 책은?" in Gowun Batang.
Two large choice cards side by side with "vs" between them:
left "빗소리처럼 쓸쓸한 책" with a rain cloud icon, right "담요처럼 포근한 책" with a cup icon.
Below the cards, a small pill button "갈피를 못 잡겠어요" with a bookmark icon, drawn as if a gauge is half filled from the left (press-and-hold). Tiny caption under it: "꾹 누르면 넘어가요".
Cream background, ink text, no other buttons.
```

## P-03 · 🎯 조건 입력 (S-02)

```
Mobile screen: one-page form titled "어떤 책을 찾고 있어요?" with a small line "첫 칸만 채우면 돼요. 나머지는 원할 때만".
Row 1 "무엇을 알고 싶어요" with a small "필수" mark: pill chips 데이터 분석, 통계, AI 똑똑하게 쓰기, 업무 자동화, 습관·집중, 시간·생산성, and a chip "✎ 직접 쓰기" which is selected and reveals a text field with placeholder "SQL, 엑셀, 파이썬, 발표 잘하기 …" and a tiny hint "이름·연락처는 적지 마세요".
Row 3 "분량 (선택)": 얇게 / 보통 / 두꺼워도 좋아요.
Row 4 "읽는 방식 (선택)": 개념부터 쉽게 / 따라 하며 실습 / 사례로 술술.
Bottom: full-width primary button "책 펼치기".
```

## P-04 · 책 펼치기 + 첫 장 (S-03, S-04)

```
Mobile screen: the old brown cloth book has just opened; its cover is swinging open to the left in 3D.
The right page (cream, faint ruled lines) is the first page:
small label "첫 장", title "당신이 찾는 책" in Gowun Batang,
a small label "당신의 책 취향" and four rows with strength dots:
"확실히 따뜻함 ●●", "문장 · 몰입 둘 다 좋아요 ○○", "알게 됨 쪽 ●○", "확실히 현실 ●●", and "얇게".
A small paper-note style line: "SQL 책은 아직 2권이에요. 나머지는 가까운 '데이터 분석' 책이에요" (show as an example variant).
Buttons below the book: secondary "한 번 고치기", primary "다음 장 →".
```

## P-05 · 책갈피 장 (S-05)

```
Mobile screen: the open old book fills the center. One translucent bookmark (see P-00 style) is inserted into the book, sticking out above the top edge by about a quarter of its height, string and knot on top.
The bookmark shows: arched window with a small rabbit on a green hill with a cloud, genre tag "에세이", title "단 한 번의 삶", one-liner "인생에도 그래프가 있다면 어떤 모양일까요?".
The page lines are faintly visible through the translucent bookmark.
Small page counter "2 / 5" at the bottom of the page.
Below the book: secondary button "패스" and primary button "궁금해요".
```

## P-06 · 궁금해요 책 보기 (S-06)

```
Mobile screen: "궁금해요 1 / 2" at the top.
A large book cover image (placeholder) centered, taking about 45% of the screen height.
Book title in Gowun Batang 20px, then "★ 9.4 · 18,800원 · 480쪽".
A small light tag line: "나온 이유 · 따뜻함 · 마음 · 현실".
Description text about 3 lines followed by "더 보기 ⌄".
Two buttons in a row: "🔖 보관" (secondary) and "예스24에서 보기 ↗" (primary).
Footer caption: "정보 제공: 예스24 · 예스24와 무관한 개인 프로젝트".
```

## P-07 · 로그인 시트 (S-07)

```
Mobile screen: the curious-book screen dimmed behind a bottom sheet.
Bottom sheet on cream: title "보관하려면 로그인이 필요해요", a small line "로그인하면 이 책갈피가 내 서재에 꽂혀요".
Two full-width buttons: a yellow Kakao-style button "카카오로 로그인하기" on top, and a white Google-style button with outline "구글로 로그인하기" below.
Tiny captions: "처음 로그인한 방법으로 들어오세요" and a link "개인정보 처리방침".
No sign-up form, no password field.
```

## P-08 · 내 서재 (S-09)

```
Mobile screen titled "내 서재" in Gowun Batang, with a small counter on the right "모은 책갈피 5 · 동물 4/7종".
Filter pills: 전체 (selected), 🍃, 🎯.
A collection board: saved bookmarks in a 3-column grid, each exactly in the P-00 style (arched window with a different animal and props, genre tag, title), strings on top.
One bookmark has a small gold "반짝" badge (rare).
One bookmark is shown flipped: its back shows a small book cover, the title, "9/29에 만남", and a small button "예스24에서 보기".
Caption: "책갈피를 누르면 뒤집혀서 책 정보가 나와요".
```

---

## 수정 프롬프트 (필요할 때 이어서)

```
Keep the layout. Make it simpler and calmer: fewer decorations, more cream space, text only in ink (#2B2724).
```
```
The bookmark looks too much like a rectangular card. Use the swallowtail V-notch bottom and the arched picture window, remove any left vertical strip or double horizontal lines.
```
```
Make the animal smaller (about half of the window) so the sky and hill are visible, and add one sky prop and one ground prop.
```
```
Use only Gowun Batang for titles and Gowun Dodum for everything else. Keep Korean text exactly as written.
```

## 체크리스트 (시안을 받을 때)

- [ ] 책갈피가 네모 카드 + 세로 띠가 아니라 **아치 창 + 제비꼬리**인가
- [ ] 버튼이 책갈피 위가 아니라 **책 아래**에 있는가
- [ ] 한 화면에 주 버튼(ink)이 **하나**인가
- [ ] 배경이 크림 종이이고 어둡거나 그라데이션이 아닌가
- [ ] 결과에 "유형 이름"이 없는가 (책이 결과)
- [ ] 로그인 화면에 가입 양식·비밀번호 칸이 없는가
- [ ] 바닥에 "예스24와 무관한 개인 프로젝트"가 있는가
- [ ] PRD에 없는 기능(리뷰, 공유 버튼, 알림 등)이 끼어들지 않았는가 → 있으면 "따르지 않을 부분"으로 기록
