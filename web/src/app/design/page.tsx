import { Button } from "@/components/Button";

const COLORS = ["paper", "paper-deep", "paper-line", "cloth", "ink", "ink-soft", "ink-muted"];
const GENRES = ["korean-fiction", "world-fiction", "sf-fantasy", "mystery", "essay", "poetry", "humanities", "science", "art-travel"];

export default function DesignPage() {
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
    </>
  );
}
