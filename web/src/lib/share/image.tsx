import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { Children, cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { BookmarkArtSvg } from "@/components/BookmarkArt";
import type { ArtCombo } from "@/lib/art/combine";
import { toneOf } from "@/lib/books/taxonomy";
import { bookTitle } from "@/lib/books/title";
import { NO_CHIP_LINE } from "./label";
import type { SharedView } from "./load";

/**
 * F-27 공유 이미지 (10-07): the 뒤표지 alone — today's bookmarks laid on the leather and the "내가 고른 길" label, never a
 * YES24 cover or intro. `og` = the 1200 × 630 link preview, `story` = 1080 × 1920 for a phone story. Drawn with next/og
 * (Satori): plain flex boxes, the bookmark pictures as SVG images with the animal inlined, Gowun fonts cut to the text used.
 */
export type ShareImageKind = "og" | "story";
export const SIZES: Record<ShareImageKind, { width: number; height: number }> = {
  og: { width: 1200, height: 630 },
  story: { width: 1080, height: 1920 },
};
const PAPER = "#F6F0E3";
const INK = "#2B2724";
const MUTED = "#7A6048";
const CHALLENGE = "오늘은 낯선 쪽으로 도전";
const LAID: readonly (readonly [number, number, number])[] = [[4, 3, -8], [36, 0, 4], [67, 4, -3], [18, 37, 6], [51, 39, -6]];

let tokens: Map<string, string> | null = null;
/** A CSS colour token ("var(--genre-essay)") as the hex Satori needs, from src/styles/tokens.css. */
export function cssColour(value: string): string {
  const name = /var\((--[a-z0-9-]+)\)/.exec(value)?.[1];
  if (!name) return value;
  tokens ??= new Map([...readFileSync(path.join(process.cwd(), "src/styles/tokens.css"), "utf8")
    .matchAll(/(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{3,8})/g)].map((m) => [m[1], m[2]]));
  return tokens.get(name) ?? MUTED;
}

/**
 * next/og draws only plain tags inside an <svg>: call the art's small helper components (Ground, BackDetail, …) through
 * until only intrinsic elements are left. They hold no hooks (BookmarkArtSvg), so calling them is the same as rendering.
 */
export function intrinsic(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map(intrinsic);
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (typeof el.type === "function") return intrinsic((el.type as (p: unknown) => ReactNode)(el.props));
  if ((el.type as unknown) === Fragment) return Children.toArray(el.props.children).map(intrinsic);
  const kids = el.props.children;
  return kids === undefined ? el : cloneElement(el, undefined, ...Children.toArray(kids).map(intrinsic));
}

const KEEP = new Set(["viewBox", "gradientUnits", "gradientTransform", "preserveAspectRatio", "clipPathUnits"]);
const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * A plain-tag React tree (intrinsic) as SVG text. next/og then draws the whole picture as one <img> — resvg reads the
 * inlined animal itself, so next/og never has to look the animal up inside the <svg> (it cannot, for a nested image).
 */
export function svgText(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(svgText).join("");
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (!isValidElement(node)) return esc(String(node));
  const el = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  const { children, style, className: _c, ...rest } = el.props;
  void _c;
  const attrs = Object.entries(rest)
    .filter(([k, v]) => v !== undefined && v !== null && v !== false && !k.startsWith("aria-") && k !== "focusable")
    .map(([k, v]) => `${KEEP.has(k) ? k : kebab(k)}="${esc(String(v))}"`);
  if (style && typeof style === "object") {
    const css = Object.entries(style as Record<string, unknown>).filter(([k]) => !k.startsWith("animation")).map(([k, v]) => `${kebab(k)}:${v}`).join(";");
    if (css) attrs.push(`style="${esc(css)}"`);
  }
  return `<${String(el.type)}${attrs.length ? ` ${attrs.join(" ")}` : ""}>${svgText(children)}</${String(el.type)}>`;
}

/** One bookmark picture as an SVG data URI — the app's own art, still, the animal inlined. */
export function artUri(art: ArtCombo, id: string): string {
  const svg = svgText(intrinsic(<BookmarkArtSvg art={art} clipId={`share-${id}`} fx="light" animalHref={animalUri(art.animal)} />))
    .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace(/width="100%"/, 'width="200" height="152"');
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const animals = new Map<string, string>();
/** An animal file as a data URI — next/og cannot fetch the app's relative /animals/ path. */
export function animalUri(name: string): string {
  if (!animals.has(name)) {
    const file = readFileSync(path.join(process.cwd(), "public/animals", `${name}.svg`));
    animals.set(name, `data:image/svg+xml;base64,${file.toString("base64")}`);
  }
  return animals.get(name)!;
}

const FONT_TIMEOUT_MS = 4000;
const FONT_CACHE_MAX = 64;
const fontCache = new Map<string, Promise<ArrayBuffer>>();

/**
 * Google Fonts cut to `text`, as TTF (Satori reads no woff2) — remembered per text (the same code draws the same letters)
 * and given up after 4 s, so a slow font server cannot hold a request open. A failed fetch is not remembered.
 */
function googleFont(family: string, weight: number, text: string): Promise<ArrayBuffer> {
  const key = `${family}:${weight}:${text}`;
  const hit = fontCache.get(key);
  if (hit) return hit;
  const load = (async () => {
    const signal = AbortSignal.timeout(FONT_TIMEOUT_MS);
    const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url, { signal })).text();
    const src = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1];
    if (!src) throw new Error(`font: no ttf for ${family}`);
    return (await fetch(src, { signal })).arrayBuffer();
  })();
  if (fontCache.size >= FONT_CACHE_MAX) fontCache.delete(fontCache.keys().next().value!);
  fontCache.set(key, load);
  load.catch(() => fontCache.delete(key));
  return load;
}

/** A title short enough for two lines on a small bookmark: cut with "…" inside the 『 』. */
function shortTitle(title: string): string {
  const t = title.replace(/\s*[:：(].*$/, "").trim() || title;
  return bookTitle(t.length > 14 ? `${t.slice(0, 13)}…` : t);
}

function chipsOf(view: SharedView): string[] {
  return [...(view.label.challenge ? [CHALLENGE] : []), ...view.label.chips];
}

/** The leather board, `w` wide (1 : 1.45), with the bookmarks and the label — the same layout as the S-11 screen. */
function Board({ view, w }: { view: SharedView; w: number }) {
  const h = Math.round(w * 1.45);
  const card = Math.round(w * 0.24);
  const cardH = Math.round(card * 1.62);
  const areaL = w * 0.05;
  const areaW = w - 22 * (w / 320) - w * 0.1 - card;
  const areaT = h * 0.05;
  const chips = chipsOf(view);
  const u = w / 320;
  return (
    <div style={{
      position: "relative", display: "flex", width: w, height: h, borderRadius: `${4 * u}px ${14 * u}px ${14 * u}px ${4 * u}px`,
      background: "linear-gradient(110deg, #6E4129, #7A4A2E 45%, #683C25)", boxShadow: "0 12px 30px rgba(0,0,0,0.28)",
    }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 22 * u, background: "#5A3420", borderRadius: `0 ${14 * u}px ${14 * u}px 0` }} />
      <div style={{ position: "absolute", top: 14 * u, bottom: 14 * u, left: 14 * u, right: 34 * u, border: `${u}px solid rgba(234,217,176,0.45)`, borderRadius: 6 * u }} />
      {view.cards.map((c, i) => {
        const [x, y, turn] = LAID[i % LAID.length];
        const tone = toneOf(c);
        return (
          <div key={c.id} style={{
            position: "absolute", left: areaL + areaW * (x / 70), top: areaT + (y > 20 ? cardH * 0.92 : y * u),
            width: card, height: cardH, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 * u, overflow: "hidden",
            padding: `${5 * u}px ${4 * u}px ${12 * u}px`, background: "#FFFDF8", borderRadius: `${8 * u}px ${8 * u}px 0 0`,
            transform: `rotate(${turn}deg)`, boxShadow: "0 3px 6px rgba(0,0,0,0.3)",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws <img> only */}
            <img src={artUri(view.arts[i], String(i))} width={card - 8 * u} height={(card - 8 * u) * 0.76} alt="" />
            <div style={{
              display: "flex", padding: `0 ${5 * u}px`, borderRadius: 99, fontSize: 7.5 * u, lineHeight: 1.6,
              background: cssColour(tone.bg), color: cssColour(tone.fg), fontFamily: "Dodum",
            }}>{c.genre}</div>
            <div style={{ display: "flex", textAlign: "center", justifyContent: "center", fontSize: 8.5 * u, lineHeight: 1.25, color: INK, fontFamily: "Batang" }}>
              {shortTitle(c.title)}
            </div>
          </div>
        );
      })}
      <div style={{
        position: "absolute", left: w * 0.08, right: 22 * u + w * 0.08, bottom: h * 0.06, display: "flex", flexDirection: "column",
        alignItems: "center", padding: `${8 * u}px ${8 * u}px ${6 * u}px`, borderRadius: 4 * u, background: PAPER,
        border: `${u}px solid #E2D6BE`,
      }}>
        <div style={{ display: "flex", fontSize: 13 * u, fontFamily: "Batang", color: INK, marginBottom: 4 * u }}>내가 고른 길</div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 4 * u }}>
          {chips.length
            ? chips.map((t) => (
              <div key={t} style={{ display: "flex", padding: `${u}px ${8 * u}px`, borderRadius: 99, background: "#ECE3CF", fontSize: 11 * u, color: INK, fontFamily: "Dodum" }}>{t}</div>
            ))
            : <div style={{ display: "flex", fontSize: 12 * u, color: MUTED, fontFamily: "Dodum" }}>{NO_CHIP_LINE}</div>}
        </div>
        <div style={{ display: "flex", marginTop: 6 * u, fontSize: 10.5 * u, color: MUTED, fontFamily: "Dodum" }}>{`이 길에서 만난 책갈피 ${view.cards.length}장`}</div>
      </div>
    </div>
  );
}

function Og({ view }: { view: SharedView }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 80, background: PAPER }}>
      <Board view={view} w={360} />
      <div style={{ display: "flex", flexDirection: "column", width: 420 }}>
        <div style={{ display: "flex", fontSize: 64, fontFamily: "Batang", color: INK }}>갈피</div>
        <div style={{ display: "flex", fontSize: 24, fontFamily: "Dodum", color: MUTED, margin: "8px 0 36px" }}>읽을 책, 갈피가 안 잡힐 때</div>
        <div style={{ display: "flex", fontSize: 32, fontFamily: "Batang", color: INK, lineHeight: 1.5 }}>{`오늘 책갈피 ${view.cards.length}장을 만났어요.`}</div>
        <div style={{ display: "flex", fontSize: 32, fontFamily: "Batang", color: INK, lineHeight: 1.5 }}>너도 갈피 잡아 봐</div>
        <div style={{ display: "flex", fontSize: 22, fontFamily: "Dodum", color: MUTED, marginTop: 28 }}>galpibook.com</div>
      </div>
    </div>
  );
}

function Story({ view }: { view: SharedView }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: PAPER }}>
      <div style={{ display: "flex", fontSize: 88, fontFamily: "Batang", color: INK }}>갈피</div>
      <div style={{ display: "flex", fontSize: 36, fontFamily: "Dodum", color: MUTED, margin: "12px 0 56px" }}>오늘 만난 책갈피</div>
      <Board view={view} w={860} />
      <div style={{ display: "flex", fontSize: 36, fontFamily: "Dodum", color: MUTED, marginTop: 64 }}>너도 갈피 잡아 봐 · galpibook.com</div>
    </div>
  );
}

/** Every letter the image draws — the fonts are fetched cut to these. */
function textOf(view: SharedView): string {
  return [
    "갈피 읽을 책, 갈피가 안 잡힐 때 오늘 책갈피 5장을 만났어요. 너도 잡아 봐 galpibook.com 오늘 만난 책갈피 · 내가 고른 길 이 길에서 만난 장",
    NO_CHIP_LINE, CHALLENGE, ...chipsOf(view), ...view.cards.flatMap((c) => [c.genre, shortTitle(c.title)]), "0123456789…『』",
  ].join("");
}

export async function shareImage(view: SharedView, kind: ShareImageKind, fonts?: { batang: ArrayBuffer; dodum: ArrayBuffer }) {
  const text = textOf(view);
  const [batang, dodum] = fonts
    ? [fonts.batang, fonts.dodum]
    : await Promise.all([googleFont("Gowun Batang", 700, text), googleFont("Gowun Dodum", 400, text)]);
  return new ImageResponse(kind === "og" ? <Og view={view} /> : <Story view={view} />, {
    ...SIZES[kind],
    fonts: [
      { name: "Batang", data: batang, weight: 700, style: "normal" },
      { name: "Dodum", data: dodum, weight: 400, style: "normal" },
    ],
    // a day at the edge, then refreshed in the background — titles and pictures may change with the catalog
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
