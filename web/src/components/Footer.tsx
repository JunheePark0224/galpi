import Link from "next/link";

export function Footer() {
  return (
    <footer style={{ padding: "var(--space-4)", textAlign: "center", fontSize: 12, color: "var(--ink-muted)" }}>
      정보 제공: 예스24 · 예스24와 무관한 개인 프로젝트 ·{" "}
      <Link href="/privacy" style={{ color: "var(--ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>처리방침</Link>
    </footer>
  );
}
