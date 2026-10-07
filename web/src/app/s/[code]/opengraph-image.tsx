import { loadShare } from "@/lib/share/load";
import { shareImage, SIZES } from "@/lib/share/image";

export const alt = "갈피 뒤표지에 놓인 오늘 만난 책갈피 다섯 장";
export const size = SIZES.og;
export const contentType = "image/png";

/** F-27: the link preview of a shared 뒤표지 (1200 × 630). A code that does not read gets the site's own card. */
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const view = loadShare(code);
  if (!view) return Response.redirect(new URL("/opengraph-image.png", process.env.NEXT_PUBLIC_SITE_URL || "https://www.galpibook.com"));
  return shareImage(view, "og");
}
