import { notFound } from "next/navigation";
import { Button } from "@/components/Button";
import { Bookmark } from "@/components/Bookmark";
import { artFromSeed } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";

const DEMO: BookCard[] = [
  { id: "demo-leaf", entry: "leaf", title: "천천히 걷는 아침", author: "천아침", genre: "에세이", field: null, oneLiner: "오늘 아침은 몇 걸음이었을까요?", oneLinerStyle: "question" },
  { id: "demo-target", entry: "target", title: "처음 만나는 쿼리", author: "김쿼리", genre: "데이터 분석", field: "데이터·통계", oneLiner: "표에서 원하는 줄만 꺼내는 쿼리를 익혀요", oneLinerStyle: "summary" },
];

const COLORS = ["paper", "paper-deep", "paper-line", "cloth", "ink", "ink-soft", "ink-muted"];
const GENRES = [
  "korean-fiction", "world-fiction", "sf-fantasy", "mystery", "essay", "poetry", "humanities", "science", "art-travel",
  "history", "society", "horror",
];

/** Token/component sheet for development. Not part of the product: a 404 on the public production site. */
export default function DesignPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <>
      <h1>디자인 확인</h1>
      <h2>색</h2>
      <ul style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: 0, listStyle: "none" }}>
        {[...COLORS.map((c) => `--${c}`), ...GENRES.map((g) => `--genre-${g}`)].map((v) => (
          <li key={v} data-token={v} style={{ fontSize: 12 }}>
            <div style={{ height: 40, borderRadius: 8, background: `var(${v})`, border: "1px solid var(--paper-line)" }} />
            {v}
          </li>
        ))}
      </ul>
      <h2>글꼴</h2>
      <p className="serif" style={{ fontSize: 28 }}>갈피 — 고운바탕</p>
      <p>읽을 책, 갈피가 안 잡힐 때 — 고운돋움</p>
      <h2>버튼</h2>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="secondary">패스</Button>
        <Button>궁금해요</Button>
      </div>
      <h2>책갈피</h2>
      <div style={{ display: "flex", gap: 16, paddingTop: 8, background: "var(--paper-deep)" }}>
        {DEMO.map((card, i) => <Bookmark key={card.id} card={card} art={artFromSeed(i + 1)} />)}
      </div>
    </>
  );
}
