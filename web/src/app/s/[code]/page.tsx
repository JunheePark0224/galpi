import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SharedBack } from "@/components/flow/SharedBack";
import { loadShare } from "@/lib/share/load";

type Params = { params: Promise<{ code: string }> };

const title = (n: number) => `갈피 — 오늘 만난 책갈피 ${n}장`;
const DESCRIPTION = "누군가 질문 몇 개로 책갈피를 만났어요. 너도 갈피 잡아 봐";

/**
 * S-12 (F-27): a shared 뒤표지. The link preview image is ./opengraph-image (the board itself, no YES24 cover). Share pages
 * are not indexed — every one is a different code for the same kind of page.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  const view = loadShare(code);
  const chips = view ? [...(view.label.challenge ? ["오늘은 낯선 쪽으로 도전"] : []), ...view.label.chips] : [];
  const TITLE = title(view?.cards.length ?? 5);
  return {
    title: TITLE,
    description: chips.length ? `내가 고른 길: ${chips.join(" · ")} — ${DESCRIPTION}` : DESCRIPTION,
    robots: { index: false, follow: true },
    openGraph: { title: TITLE, description: DESCRIPTION, url: `/s/${code}`, type: "website", siteName: "갈피", locale: "ko_KR" },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  };
}

export default async function SharePage({ params }: Params) {
  const { code } = await params;
  const view = loadShare(code);
  if (!view) redirect("/");
  return <SharedBack cards={view.cards} arts={view.arts} label={view.label} />;
}
