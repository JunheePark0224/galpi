---
version: alpha
name: Galpi
description: A mobile web book recommender where an old cloth-bound book opens and each page holds a translucent bookmark with a cute animal window, a book title and a one-line first impression.
colors:
  primary: "#2B2724"
  on-primary: "#FAF5EA"
  secondary: "#7A4A2E"
  on-secondary: "#FAF5EA"
  secondary-edge: "#5A3420"
  surface: "#FAF5EA"
  surface-deep: "#F0E6D0"
  surface-frost: "#F4F1EA"
  outline: "#DDD0B4"
  on-surface: "#2B2724"
  on-surface-soft: "#4A433D"
  on-surface-muted: "#7A6048"
  white: "#FFFFFF"
  genre-korean-fiction: "#A94C60"
  genre-world-fiction: "#7E5595"
  genre-sf-fantasy: "#44548F"
  genre-mystery: "#3E474C"
  genre-essay: "#4A7456"
  genre-poetry: "#A0593F"
  genre-humanities: "#7D6337"
  genre-science: "#2B7178"
  genre-art-travel: "#B8912F"
  genre-history: "#8E3A3A"
  genre-society: "#5E6A2B"
  genre-horror: "#6B2F5B"
  field-data: "#3A6684"
  field-ai: "#5E55A0"
  field-habit: "#9E6232"
  field-money: "#3D7350"
  field-mind: "#A04F6E"
  field-career: "#2D6F73"
typography:
  headline-display:
    fontFamily: Gowun Batang
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.2
  headline-md:
    fontFamily: Gowun Batang
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.35
  title-bookmark:
    fontFamily: Gowun Batang
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1.3
  body-md:
    fontFamily: Gowun Dodum
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.7
  body-sm:
    fontFamily: Gowun Dodum
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.6
  label-md:
    fontFamily: Gowun Dodum
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.2
  label-sm:
    fontFamily: Gowun Dodum
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.2
rounded:
  sm: 2px
  book-edge: 10px
  bookmark-top: 10px
  card: 12px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  touch-target: 44px
  bookmark-width: 112px
  bookmark-height: 224px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 12px
    height: 44px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 12px
    height: 44px
  chip-choice:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 10px
  chip-choice-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  bookmark:
    backgroundColor: "{colors.surface-frost}"
    textColor: "{colors.on-surface}"
    typography: "{typography.title-bookmark}"
    rounded: "{rounded.bookmark-top}"
    width: "{spacing.bookmark-width}"
    height: "{spacing.bookmark-height}"
  bookmark-line:
    backgroundColor: "{colors.surface-frost}"
    textColor: "{colors.on-surface-soft}"
    typography: "{typography.body-sm}"
  book-cover:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    rounded: "{rounded.book-edge}"
  book-cover-edge:
    backgroundColor: "{colors.secondary-edge}"
    textColor: "{colors.on-secondary}"
  book-page:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.book-edge}"
  balance-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.card}"
    padding: 18px
  hold-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface-soft}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 8px
  hold-button-fill:
    backgroundColor: "{colors.surface-deep}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.card}"
    height: 44px
  caption:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface-muted}"
    typography: "{typography.label-sm}"
  chip-genre-korean-fiction:
    backgroundColor: "{colors.genre-korean-fiction}"
    textColor: "{colors.white}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
  chip-genre-world-fiction:
    backgroundColor: "{colors.genre-world-fiction}"
    textColor: "{colors.white}"
  chip-genre-sf-fantasy:
    backgroundColor: "{colors.genre-sf-fantasy}"
    textColor: "{colors.white}"
  chip-genre-mystery:
    backgroundColor: "{colors.genre-mystery}"
    textColor: "{colors.white}"
  chip-genre-essay:
    backgroundColor: "{colors.genre-essay}"
    textColor: "{colors.white}"
  chip-genre-poetry:
    backgroundColor: "{colors.genre-poetry}"
    textColor: "{colors.white}"
  chip-genre-humanities:
    backgroundColor: "{colors.genre-humanities}"
    textColor: "{colors.white}"
  chip-genre-science:
    backgroundColor: "{colors.genre-science}"
    textColor: "{colors.white}"
  chip-genre-art-travel:
    backgroundColor: "{colors.genre-art-travel}"
    textColor: "{colors.primary}"
  chip-genre-history:
    backgroundColor: "{colors.genre-history}"
    textColor: "{colors.white}"
  chip-genre-society:
    backgroundColor: "{colors.genre-society}"
    textColor: "{colors.white}"
  chip-genre-horror:
    backgroundColor: "{colors.genre-horror}"
    textColor: "{colors.white}"
  chip-field-data:
    backgroundColor: "{colors.field-data}"
    textColor: "{colors.white}"
  chip-field-ai:
    backgroundColor: "{colors.field-ai}"
    textColor: "{colors.white}"
  chip-field-habit:
    backgroundColor: "{colors.field-habit}"
    textColor: "{colors.white}"
  chip-field-money:
    backgroundColor: "{colors.field-money}"
    textColor: "{colors.white}"
  chip-field-mind:
    backgroundColor: "{colors.field-mind}"
    textColor: "{colors.white}"
  chip-field-career:
    backgroundColor: "{colors.field-career}"
    textColor: "{colors.white}"
---

# Galpi (갈피)

Derived from `../DESIGN.md` (the source of truth). Edit that file first, then regenerate this one.

## Overview

Galpi means "the place where a bookmark sits" in Korean, and the idiom "갈피를 못 잡다" means "can't find your way". The product helps people who don't know what to read next.

The feeling is **a warm old book on a quiet afternoon, with one cute surprise on every page**. Simple and calm like a literary bookmark, but a little playful: each bookmark has a small round-faced animal sitting on a hill inside an arched window. The book is the hero; the bookmark is its face; everything else steps back.

Audience: Korean readers in their 20s on mobile phones, often opening the link from KakaoTalk. Language on screen is Korean. Tone is friendly and honest, never salesy.

## Colors

- **Ink (#2B2724)** — all text, and the one filled primary button per screen.
- **Cloth brown (#7A4A2E)** — the cloth cover of the old book. Used only for the book itself.
- **Cream paper (#FAF5EA)** — every background. Pages have faint ruled lines in outline beige (#DDD0B4).
- **Frost (#F4F1EA, or 60% white with a 3px backdrop blur)** — the translucent film of every bookmark. Text on frost is always ink.
- **Genre colors** — eighteen muted colors (twelve reading genres, six study fields) used only for the small genre name tag, the bookmark string and the dashed stitch line on a bookmark. Never as large fills.
- No dark mode. No gradients except the animal window sky.

## Typography

Two Korean Google Fonts only.

- **Gowun Batang** (serif) — the logo, screen titles and book titles. Literary, like a book spine.
- **Gowun Dodum** (rounded sans) — everything else: one-line impressions, buttons, chips, captions.
- Minimum size 12px. Book titles on bookmarks wrap to at most two lines; one-liners to at most three.

## Layout

Single column, mobile first (360–430px wide), 16px side margins. The old book sits in the center of the screen, about 70% of the width. Bookmarks stick out above the top edge of the book by about a quarter of their height. Action buttons (Pass / Curious) sit **below** the book, never on the bookmark. Spacing follows a 4px base scale (4, 8, 12, 16, 24, 32). Every tap target is at least 44px.

## Elevation & Depth

Almost flat. Depth comes from the physical metaphor, not shadows: the book has a slightly darker inner spine strip on the page, the cover opens in 3D, pages flip, and the translucent bookmark lets the page lines show through. Bottom sheets (login) use a single soft shadow.

## Shapes

- **Bookmark**: 1:2 ratio, top corners rounded 10px, a small punched hole near the top with a colored string and knot above it, and a **swallowtail V notch** at the bottom (7% of the height). The picture sits in an **arched window** (fully rounded top) under the hole.
- **Book**: spine side square, outer side rounded 10px.
- **Buttons and chips**: fully rounded pills.
- **Cards**: 12px.

## Components

- **Old book** — cloth-brown cover with the word 갈피 in Gowun Batang; opens to cream pages with faint lines.
- **Bookmark** — frost film; arched window with sky color, hill, a small animal (about 55% of the window) sitting on the hill, one sky prop (moon, cloud, stars, birds, big star) and one ground prop (grass, flowers, a book stack, a mushroom, or none); under the window a genre name tag, the book title, a one-line first impression, and a dashed stitch line in the genre color; the word 갈피 small at the bottom.
- **Pass / Curious buttons** — below the book. Curious is the primary (ink) button, Pass is secondary (outlined).
- **Balance game card** — two big choice cards side by side with "vs" between them, an icon on each, and a thin progress bar of 9 steps above. Under the cards a small pill "갈피를 못 잡겠어요" that fills like a gauge while pressed and held.
- **Goal form** — one screen: a required "what do you want to know" row of choice chips plus a "write your own" chip that reveals a text field; optional rows for level, length and reading style; a primary "책 펼치기" button.
- **First page summary** — "당신이 찾는 책" and the chosen taste, with strength dots (●● / ●○ / ○○), and an honest note when few books match.
- **Curious book view** — one book at a time: large cover, title, rating · price · pages, a small "why this book" line, a collapsible description with "더 보기", then Save and "예스24에서 보기" buttons, and a small source line.
- **My library** — a collection board of the saved bookmarks exactly as they were drawn, three per row; tapping one flips it to show the cover, the date met, and the store link.
- **Login sheet** — bottom sheet with "카카오로 로그인하기" above "구글로 로그인하기". No sign-up form.
- **Footer caption** — "정보 제공: 예스24 · 예스24와 무관한 개인 프로젝트".

## Do's and Don'ts

- Do keep one primary (ink) button per screen.
- Do keep text on bookmarks in ink only, so it stays readable over the page lines.
- Do use genre colors only for the tag, string and stitch line.
- Don't use a rectangular card with a vertical color strip on the left and two horizontal color rules — that is another publisher's bookmark style. Use the arched window and swallowtail shape.
- Don't show a personality "type" name as a result; the books are the result.
- Don't use stars, pentagrams or religious symbols on the book cover.
- Don't use dark or gradient backgrounds; the page is always cream paper.
- Don't put buttons on the bookmark itself.
