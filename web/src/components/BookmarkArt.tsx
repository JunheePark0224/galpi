import { BACKGROUNDS, artTier, tierOf, type ArtCombo, type Background, type GroundProp, type SkyProp } from "@/lib/art/combine";
import styles from "./BookmarkArt.module.css";

// Window: 100 × 76, arch radius = half the width (DESIGN 4절). Hill surface sits near y = 52–55.
const ARCH = "M0 76 V50 A50 50 0 0 1 100 50 V76 Z";
const HILL = "M-5 76 V60 Q50 44 105 60 V76 Z";
// A-03: sky props white-ish, ground props calm colours. 초판본 parts in gold (rare-art.html).
const WHITE = "#FFFFFF";
const MOON = "#FFF6DA";
const STAR = "#FFF1B8";
const GRASS = "#5F7F52";
const GOLD = "#E2B64A";
const RIM = "#D9B65A";
const SPARK = "#FFE9A8";

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
    case "rainbow":
      return (
        <g fill="none" strokeWidth="2.2" opacity="0.9">
          <path d="M60 32 A14 14 0 0 1 88 32" stroke="#E98A7A" /><path d="M62.3 32 A11.7 11.7 0 0 1 85.7 32" stroke="#F2D16B" />
          <path d="M64.6 32 A9.4 9.4 0 0 1 83.4 32" stroke="#9CC98A" /><path d="M66.9 32 A7.1 7.1 0 0 1 81.1 32" stroke="#8AB7DE" />
        </g>
      );
    case "shooting":
      return (<g><path d="M58 12 L76 23" stroke={WHITE} strokeWidth="1.4" strokeLinecap="round" opacity="0.8" /><path d={starPath(78, 25, 4, 1.5, 5)} fill={STAR} /></g>);
    case "goldmoon":
      return (
        <g>
          <circle cx="75" cy="22" r="8" fill={GOLD} /><circle cx="79" cy="19" r="7" fill={sky} />
          <path d={starPath(62, 15, 2.2, 0.7, 4)} fill={GOLD} /><path d={starPath(88, 32, 1.8, 0.6, 4)} fill={GOLD} />
        </g>
      );
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
    case "clover":
      return (
        <g>
          <path d="M16 57 Q15 52 16.3 48" stroke="#4E7A4A" strokeWidth="1.2" fill="none" />
          <g fill="#5E9A58"><circle cx="14" cy="45" r="2.6" /><circle cx="18.6" cy="45" r="2.6" /><circle cx="14" cy="49.6" r="2.6" /><circle cx="18.6" cy="49.6" r="2.6" /></g>
        </g>
      );
    case "firefly":
      return (
        <g>
          {[[13, 44, 3.4, 1.3], [86, 40, 3.2, 1.2], [21, 35, 2.6, 1]].map(([cx, cy, glow, dot]) => (
            <g key={`${cx}-${cy}`}><circle cx={cx} cy={cy} r={glow} fill="#FFF3A6" opacity="0.4" /><circle cx={cx} cy={cy} r={dot} fill="#FFE866" /></g>
          ))}
        </g>
      );
    case "goldbook":
      return (
        <g>
          <rect x="76" y="45" width="17" height="11" rx="1.5" fill="#6B3A22" stroke={GOLD} strokeWidth="1" />
          <rect x="83.5" y="45" width="2" height="11" fill={GOLD} /><path d={starPath(80, 50.5, 1.6, 0.6, 4)} fill={GOLD} />
        </g>
      );
    case "none":
      return null;
  }
}

const CHERRY_PETALS = [[18, 20], [34, 12], [60, 30], [88, 18], [26, 38], [70, 10]] as const;
const GALAXY_STARS = [[12, 14], [30, 8], [48, 20], [70, 12], [86, 28], [22, 32], [58, 6], [92, 10]] as const;
const STUDY_COLOURS = ["#3A6684", "#A94C60", "#4A7456", "#B8912F", "#5E55A0"] as const;

/** The drawn details of the 한정판·초판본 backgrounds (rare-art.html `back`). */
function BackDetail({ kind }: { kind: Background }) {
  switch (kind) {
    case "cherry":
      return (<g fill="#F3B6C6">{CHERRY_PETALS.map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="2.2" ry="1.3" transform={`rotate(${i * 40} ${x} ${y})`} />)}</g>);
    case "sunset":
      return <circle cx="50" cy="56" r="11" fill="#FFD59A" opacity="0.8" />;
    case "aurora":
      return (
        <g>
          <path d="M-5 30 Q20 12 45 26 T100 18 L100 30 Q75 38 50 34 T-5 42 Z" fill="#7FD8B0" opacity="0.45" />
          <path d="M-5 22 Q30 6 60 20 T105 12 L105 18 Q70 28 45 24 T-5 30 Z" fill="#6CC3D6" opacity="0.35" />
          <path d={starPath(20, 10, 1.4, 0.5, 4)} fill={WHITE} /><path d={starPath(84, 30, 1.2, 0.4, 4)} fill={WHITE} />
        </g>
      );
    case "galaxy":
      return (
        <g>
          <path d="M-5 50 Q40 28 105 4 L105 18 Q50 36 -5 62 Z" fill="#B9B2EC" opacity="0.25" />
          {GALAXY_STARS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 0.7 : 1} fill={WHITE} />)}
          <path d={starPath(40, 12, 2.4, 0.8, 4)} fill={GOLD} /><path d={starPath(80, 20, 2, 0.7, 4)} fill={GOLD} />
        </g>
      );
    case "study":
      return (
        <g>
          {Array.from({ length: 14 }, (_, i) => {
            const x = i * 7.4;
            const h = 20 + ((i * 37) % 12);
            return (
              <g key={i}>
                <rect x={x} y={44 - h} width="6.4" height={h} fill={STUDY_COLOURS[i % 5]} opacity="0.9" />
                <rect x={x} y={48 - h} width="6.4" height="1.2" fill={GOLD} />
              </g>
            );
          })}
          <rect x="0" y="44" width="100" height="2.2" fill={GOLD} />
        </g>
      );
    default:
      return null;
  }
}

type Spark = readonly [number, number, number?];
function Sparkles({ points }: { points: readonly Spark[] }) {
  return (
    <g fill={SPARK}>
      {points.map(([x, y, size = 2.6], i) => (
        <path key={i} className={styles.tw} style={{ animationDelay: `${i * 0.45}s` }} d={starPath(x, y, size, size * 0.32, 4)} />
      ))}
    </g>
  );
}
const ANIMAL_SPARKS: readonly Spark[] = [[24, 26], [78, 34, 2.2], [30, 50, 1.8], [72, 14, 2]];
const PROP_FX = {
  goldmoon: { aura: [76, 21, 13], sparks: [[66, 10, 2.2], [90, 26, 1.8]] },
  goldbook: { aura: [84.5, 50, 12], sparks: [[74, 42, 2], [95, 46, 1.6]] },
} as const satisfies Record<string, { aura: readonly [number, number, number]; sparks: readonly Spark[] }>;
const DUST = [[14, 70], [30, 74], [46, 68], [62, 72], [78, 70], [90, 74], [22, 66]] as const;

function PropAura({ kind, aura }: { kind: string; aura: string }) {
  const fx = PROP_FX[kind as keyof typeof PROP_FX];
  return fx ? <circle className={styles.aura} cx={fx.aura[0]} cy={fx.aura[1]} r={fx.aura[2]} fill={`url(#${aura})`} /> : null;
}
function PropSparkles({ kind }: { kind: string }) {
  const fx = PROP_FX[kind as keyof typeof PROP_FX];
  return fx ? <Sparkles points={fx.sparks} /> : null;
}

/**
 * C-03 — sky, one sky prop, hill, the animal at 55% sitting on the hill, one ground prop. Decorative only.
 * 초판본 parts (도감 v1, rare-art.html · first-edition-effects.gif): a gold rim on the window and a light sweep now and then;
 * an animal gets a breathing aura + four sparkles, a background gold dust, a prop a glow + two sparkles. `fx="light"`
 * (a moving or small bookmark — T-03, the rods, the 도감) and prefers-reduced-motion keep the rim and a still aura only.
 * Ids (clip, gradients) are made from `clipId`, so it must be unique on the page.
 */
export function BookmarkArt({ art, clipId, fx = "full" }: { art: ArtCombo; clipId: string; fx?: "full" | "light" }) {
  const bg = BACKGROUNDS[art.bg] ?? BACKGROUNDS.peach;
  const first = (kind: "animal" | "bg" | "sky" | "ground") => tierOf(kind, art[kind]) === "first_edition";
  const tier = artTier(art);
  const golden = tier === "first_edition";
  const full = fx === "full";
  const sun = `${clipId}-sun`;
  const aura = `${clipId}-aura`;
  return (
    <svg
      viewBox="0 0 100 76" width="100%" aria-hidden="true" focusable="false" style={{ display: "block" }}
      className={full ? undefined : styles.still} data-tier={tier}
    >
      <defs>
        <clipPath id={clipId}><path d={ARCH} /></clipPath>
        {art.bg === "sunset" && (
          <linearGradient id={sun} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9C7BB8" /><stop offset="0.55" stopColor="#F09A7A" /><stop offset="1" stopColor="#F8C98A" />
          </linearGradient>
        )}
        {golden && (
          <radialGradient id={aura}>
            <stop offset="0" stopColor="#FFE29A" stopOpacity="0.95" /><stop offset="0.6" stopColor="#F3C861" stopOpacity="0.35" />
            <stop offset="1" stopColor="#F3C861" stopOpacity="0" />
          </radialGradient>
        )}
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="100" height="76" fill={art.bg === "sunset" ? `url(#${sun})` : bg.sky} />
        <BackDetail kind={art.bg} />
        {full && first("bg") && (
          <g fill="#F3D98A">
            {DUST.map(([x, y], i) => <circle key={i} className={styles.dust} style={{ animationDelay: `${i * 0.45}s` }} cx={x} cy={y} r={i % 2 ? 0.9 : 1.2} />)}
          </g>
        )}
        {first("sky") && <PropAura kind={art.sky} aura={aura} />}
        <Sky kind={art.sky} sky={bg.sky} />
        {full && first("sky") && <PropSparkles kind={art.sky} />}
        <path d={HILL} fill={bg.hill} />
        {first("animal") && <circle className={styles.aura} cx="50" cy="40" r="27" fill={`url(#${aura})`} />}
        <image href={`/animals/${art.animal}.svg`} x="22.5" y="12" width="55" height="55" />
        {full && first("animal") && <Sparkles points={ANIMAL_SPARKS} />}
        {first("ground") && <PropAura kind={art.ground} aura={aura} />}
        <Ground kind={art.ground} />
        {full && first("ground") && <PropSparkles kind={art.ground} />}
        {full && golden && (
          <g transform="skewX(-20)"><rect className={styles.sweep} x="-30" y="-10" width="16" height="100" fill="#FFF6D6" opacity="0.35" /></g>
        )}
        {golden && (
          <g fill="none" data-part="rim">
            <path d={ARCH} stroke={RIM} strokeWidth="7" opacity="0.25" />
            <path d={ARCH} stroke={RIM} strokeWidth="3.4" />
          </g>
        )}
      </g>
    </svg>
  );
}

/**
 * 도감 못 만난 칸 (시안 ①②): the part's shape alone, drawn flat by the cell's CSS (a silhouette). Backgrounds have no
 * shape of their own — only the "?" shows. Decorative.
 */
export function PartShape({ kind, value, className }: { kind: "animal" | "bg" | "sky" | "ground"; value: string; className?: string }) {
  if (kind === "animal") {
    // eslint-disable-next-line @next/next/no-img-element -- a 100 × 100 SVG drawn flat by CSS; no optimisation to gain
    return <img className={className} src={`/animals/${value}.svg`} alt="" aria-hidden="true" draggable={false} />;
  }
  if (kind === "bg" || value === "none") return null;
  return (
    <svg className={className} viewBox="0 0 100 76" aria-hidden="true" focusable="false">
      {kind === "sky" ? <Sky kind={value as SkyProp} sky="#000" /> : <Ground kind={value as GroundProp} />}
    </svg>
  );
}
