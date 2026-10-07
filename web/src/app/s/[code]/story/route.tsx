import { loadShare } from "@/lib/share/load";
import { shareImage } from "@/lib/share/image";

/** F-27: the 1080 × 1920 story image of a shared 뒤표지 — S-11 [이미지로 공유] hands it to the share sheet. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const view = loadShare(code);
  if (!view) return new Response("not found", { status: 404 });
  return shareImage(view, "story");
}
