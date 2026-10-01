import type { Metadata } from "next";
import { Library } from "@/components/library/Library";

export const metadata: Metadata = { title: "내 책갈피 · 갈피", robots: { index: false } };

/** S-09 (PRD F-13): the logged-in person's rods. Static shell; the rods come from /api/library in the browser. */
export default function LibraryPage() {
  return <Library />;
}
