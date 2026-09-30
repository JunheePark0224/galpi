import { BACKGROUNDS, type ArtCombo, type GroundProp, type SkyProp } from "@/lib/art/combine";

// Window: 100 × 76, arch radius = half the width (DESIGN 4절). Hill surface sits near y = 52–55.
const ARCH = "M0 76 V50 A50 50 0 0 1 100 50 V76 Z";
const HILL = "M-5 76 V60 Q50 44 105 60 V76 Z";
// A-03: sky props white-ish, ground props calm colours.
const WHITE = "#FFFFFF";
const MOON = "#FFF6DA";
const STAR = "#FFF1B8";
const GRASS = "#5F7F52";

function starPath(cx: number, cy: number, outer: number, inner: number, points: number): string {
  const parts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    parts.push(`${i ? "L" : "M"}${(cx + r * Math.cos(angle)).toFixed(1)} ${(cy + r * Math.sin(angle)).toFixed(1)}`);
  }
  return `${parts.join(" ")} Z`;
}

function Sky({ kind, sky }: { kind: SkyProp; sky: string }) {
  switch (kind) {
    case "moon":
      return (<g><circle cx="75" cy="22" r="7" fill={MOON} /><circle cx="78.5" cy="19.5" r="6" fill={sky} /></g>);
    case "cloud":
      return (<g fill={WHITE} opacity="0.92"><ellipse cx="72" cy="25" rx="10" ry="4.5" /><circle cx="68" cy="22" r="4.5" /><circle cx="75" cy="20.5" r="5.5" /></g>);
    case "stars":
      return (<g fill={WHITE}><path d={starPath(70, 18, 3.2, 1.1, 4)} /><path d={starPath(80, 26, 2.4, 0.8, 4)} /><path d={starPath(26, 24, 2.6, 0.9, 4)} /></g>);
    case "birds":
      return (<g stroke={WHITE} strokeWidth="1.3" fill="none" strokeLinecap="round"><path d="M64 23 q3 -3 6 0 q3 -3 6 0" /><path d="M74 16 q2 -2 4 0 q2 -2 4 0" /></g>);
    case "bigStar":
      return <path d={starPath(74, 22, 7, 3, 5)} fill={STAR} />;
  }
}

function Ground({ kind }: { kind: GroundProp }) {
  switch (kind) {
    case "grass":
      return (<path d="M10 56 l2 -7 l2 7 M15 56 l2 -9 l2 9 M82 56 l2 -8 l2 8 M87 56 l2 -6 l2 6" stroke={GRASS} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />);
    case "flowers":
      return (<g><path d="M14 56 V48 M86 56 V50" stroke={GRASS} strokeWidth="1.4" /><circle cx="14" cy="47" r="2.8" fill="#E8998A" /><circle cx="86" cy="49" r="2.4" fill="#F2D16B" /></g>);
    case "books":
      return (<g><rect x="78" y="51.5" width="15" height="4.5" rx="1" fill="#7A4A2E" /><rect x="79.5" y="47" width="12" height="4.5" rx="1" fill="#3A6684" /><rect x="81" y="43" width="9.5" height="4" rx="1" fill="#B8912F" /></g>);
    case "mushroom":
      return (<g><rect x="12.5" y="49" width="4" height="7" rx="1.5" fill="#F4EBDD" /><path d="M8 50 a6.5 5 0 0 1 13 0 Z" fill="#C4574A" /><circle cx="12" cy="47.5" r="1" fill={WHITE} /><circle cx="16.5" cy="46.8" r="0.9" fill={WHITE} /></g>);
    case "none":
      return null;
  }
}

/** C-03 — sky, one sky prop, hill, the animal at 55% sitting on the hill, one ground prop. Decorative only. */
export function BookmarkArt({ art, clipId }: { art: ArtCombo; clipId: string }) {
  const bg = BACKGROUNDS[art.bg];
  return (
    <svg viewBox="0 0 100 76" width="100%" aria-hidden="true" focusable="false" style={{ display: "block" }}>
      <defs><clipPath id={clipId}><path d={ARCH} /></clipPath></defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="100" height="76" fill={bg.sky} />
        <Sky kind={art.sky} sky={bg.sky} />
        <path d={HILL} fill={bg.hill} />
        <image href={`/animals/${art.animal}.svg`} x="22.5" y="12" width="55" height="55" />
        <Ground kind={art.ground} />
      </g>
    </svg>
  );
}
