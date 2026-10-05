import Link from "next/link";

export function Footer() {
  return (
    <footer style={{ padding: "var(--space-4)", textAlign: "center", fontSize: 12, color: "var(--ink-muted)" }}>
      정보 제공: 예스24 · 예스24와 무관한 개인 프로젝트 ·{" "}
      {/* launch sweep 10-05: one word that never breaks ("처 / 리방침" at 320px), and a 44px touch area — the padding is
          taken back by the negative margin, so the line does not move */}
      <Link
        href="/privacy"
        style={{
          display: "inline-block", whiteSpace: "nowrap", padding: "14px 4px", margin: "-14px -4px",
          color: "var(--ink)", textDecoration: "underline", textUnderlineOffset: 3,
        }}
      >
        처리방침
      </Link>
    </footer>
  );
}
