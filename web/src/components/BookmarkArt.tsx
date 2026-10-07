import { useId } from "react";
import {
  ART_KINDS, BACKGROUNDS, highestTier, tierOf, type ArtCombo, type ArtKind, type Background, type GroundProp,
} from "@/lib/art/combine";
import styles from "./BookmarkArt.module.css";

// Window: 100 × 76, arch radius = half the width (DESIGN 4절). Hill surface sits near y = 52–55.
const ARCH = "M0 76 V50 A50 50 0 0 1 100 50 V76 Z";
const HILL = "M-5 76 V60 Q50 44 105 60 V76 Z";
// A-03: ground props in calm colours. 초판본 parts in gold (rare-art.html).
const WHITE = "#FFFFFF";
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

const STEAM = ["M13 46 q-1.6 -2.4 0 -4.6 q1.6 -2.2 0 -4.4", "M16.4 46 q-1.6 -2.4 0 -4.8 q1.6 -2.4 0 -4.6"] as const;
const JAR_FLIES = [[83, 52], [86.6, 47.6], [86, 53.6]] as const;
const delay = (i: number, step: number) => ({ animationDelay: `${(i * step).toFixed(2)}s` });

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
          <g data-part="ribbon">
            <path d="M15.8 53.4 l-2.8 -1.7 v3.4 Z M15.8 53.4 l2.8 -1.7 v3.4 Z" fill={GOLD} />
            <path d="M15.4 53.8 l-1.2 2.6 M16.2 53.8 l1.4 2.4" stroke={GOLD} strokeWidth="0.7" strokeLinecap="round" />
            <circle cx="15.8" cy="53.4" r="0.8" fill="#B8862A" />
          </g>
          <g data-part="dew">
            <circle cx="19.2" cy="44.4" r="1.25" fill="#D6F1FF" stroke={WHITE} strokeWidth="0.3" opacity="0.95" />
            <circle cx="18.8" cy="44" r="0.4" fill={WHITE} />
          </g>
        </g>
      );
    case "teacup":
      return (
        <g>
          <g data-part="steam" stroke={WHITE} strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.85">
            {STEAM.map((d, i) => <path key={i} className={styles.steam} style={delay(i, 0.9)} d={d} />)}
          </g>
          <ellipse cx="15" cy="55.6" rx="7.2" ry="1.7" fill="#F4EBDD" stroke="#B8912F" strokeWidth="0.5" />
          <path d="M20.2 49.4 a2.3 2.3 0 0 1 0 4.2" stroke="#3A6684" strokeWidth="0.9" fill="none" />
          <path d="M9.6 48 H20.4 V50.6 A5.4 4.6 0 0 1 9.6 50.6 Z" fill="#F7F1E6" stroke="#3A6684" strokeWidth="0.6" />
          <rect x="9.6" y="48" width="10.8" height="0.9" fill={GOLD} />
          <g fill="#3A6684"><circle cx="12.4" cy="51" r="0.6" /><circle cx="15" cy="51.8" r="0.6" /><circle cx="17.6" cy="51" r="0.6" /></g>
        </g>
      );
    case "jar":
      return (
        <g>
          <rect x="81.3" y="40" width="7.4" height="3" rx="0.8" fill="#A0784E" />
          <rect x="80" y="42.6" width="10" height="13.6" rx="3" fill="#EAF4F6" fillOpacity="0.4" stroke="#9FB7C2" strokeWidth="0.7" />
          <g data-part="jar-light">
            {JAR_FLIES.map(([x, y], i) => (
              <g key={i} className={styles.jarfly} style={delay(i, 0.8)}>
                <circle cx={x} cy={y} r="2.2" fill="#FFF3A6" opacity="0.45" /><circle cx={x} cy={y} r="0.8" fill="#FFE866" />
              </g>
            ))}
          </g>
          <path d="M81.6 45.5 V53" stroke={WHITE} strokeWidth="0.7" strokeLinecap="round" opacity="0.7" />
        </g>
      );
    case "quill":
      return (
        <g data-part="quill">
          <path d="M85.4 47 L93 31" stroke="#5A4A3A" strokeWidth="0.6" />
          <path d="M86.6 44 C 85 38, 89 32, 94.5 29 C 94 35, 91 41, 86.6 44 Z" fill="#8FAE8A" stroke="#8E7BB8" strokeWidth="0.6" />
          <path d="M88.5 40 l2.4 -1.2 M89.8 37.2 l2.2 -1.2" stroke="#6E8F6A" strokeWidth="0.4" />
          <rect x="83" y="46.4" width="5" height="3" rx="0.6" fill="#2E3456" />
          <rect x="83" y="48.4" width="5" height="0.8" fill={GOLD} />
          <path d="M79.6 50 H91.4 L90.4 56 H80.6 Z" fill="#2E3456" />
          <rect x="80.4" y="52" width="10.2" height="0.7" fill="#5B6491" />
        </g>
      );
    case "musicbox":
      return (
        <g>
          <path d="M77.4 50 A7.6 7.6 0 0 1 92.6 50 Z" fill="#DDEFFF" fillOpacity="0.35" stroke="#CFE3F5" strokeWidth="0.6" />
          <circle cx="85" cy="45" r="1.9" fill={GOLD} />
          <g data-part="orbit" className={styles.orbit}>
            <circle cx="89.2" cy="45.6" r="1" fill="#F4F1E6" />
            <path d={starPath(80.6, 44.2, 1.1, 0.4, 4)} fill={SPARK} />
          </g>
          <rect x="77" y="50" width="16" height="6" rx="1" fill="#6B3A22" stroke={GOLD} strokeWidth="0.8" />
          <rect x="77" y="52.4" width="16" height="0.8" fill={GOLD} />
          <path d="M93 53 h1.8 M94.8 51.8 v2.4" stroke={GOLD} strokeWidth="0.7" strokeLinecap="round" />
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

const CHERRY_PETALS = [[18, 14], [34, 6], [60, 22], [88, 10], [26, 32], [72, 4], [48, 38], [92, 30]] as const;
const SUNSET_BIRDS = [[24, 20, 1], [36, 14, 0.8], [70, 24, 0.7]] as const;
const SUMMER_STARS = [[14, 10], [42, 6], [76, 14], [90, 6]] as const;
const FIREFLIES = [[14, 46], [30, 36], [52, 44], [70, 30], [86, 42], [40, 22]] as const;
const GALAXY_STARS = [[12, 14], [30, 8], [48, 20], [70, 12], [86, 28], [22, 32], [58, 6], [92, 10]] as const;
const STUDY_COLOURS = ["#3A6684", "#A94C60", "#4A7456", "#B8912F", "#5E55A0"] as const;
const DUST = [[14, 70], [30, 74], [46, 68], [62, 72], [78, 70], [90, 74], [22, 66]] as const;

/**
 * The 한정판·초판본 backgrounds are living (10-07 A, 시안 `deco/sky.html` A): each has its own gentle motion — petals fall
 * (벚꽃 언덕), birds drift past the setting sun (노을), the lights wave (오로라), fireflies rise (여름밤, the fireflies that
 * were a ground prop), stars twinkle and a star shoots now and then (은하수), gold dust rises (금박 서재). Every moving
 * thing is also a still picture: with fx="light" (`.still`) or reduced motion it stands where it is drawn (a shooting star,
 * which only exists in motion, is not shown). 일반판 backgrounds are a plain sky.
 */
function BackDetail({ kind }: { kind: Background }) {
  switch (kind) {
    case "cherry":
      return (
        <g fill="#F3B6C6">
          {CHERRY_PETALS.map(([x, y], i) => (
            <ellipse key={i} className={styles.petal} style={delay(i, 0.7)} cx={x} cy={y} rx="2.2" ry="1.3" transform={`rotate(${i * 40} ${x} ${y})`} />
          ))}
        </g>
      );
    case "sunset":
      return (
        <g>
          <circle cx="50" cy="56" r="11" fill="#FFD59A" opacity="0.8" />
          <g stroke="#5A3A4A" strokeWidth="1" fill="none" strokeLinecap="round">
            {SUNSET_BIRDS.map(([x, y, s], i) => (
              <path key={i} className={styles.drift} style={delay(i, 1.3)} d={`M${x} ${y} q${2 * s} ${-2 * s} ${4 * s} 0 q${2 * s} ${-2 * s} ${4 * s} 0`} />
            ))}
          </g>
        </g>
      );
    case "aurora":
      return (
        <g>
          <path className={styles.wave} d="M-5 30 Q20 12 45 26 T100 18 L100 30 Q75 38 50 34 T-5 42 Z" fill="#7FD8B0" opacity="0.45" />
          <path className={styles.wave} style={delay(1, 1.6)} d="M-5 22 Q30 6 60 20 T105 12 L105 18 Q70 28 45 24 T-5 30 Z" fill="#6CC3D6" opacity="0.35" />
          <path d={starPath(20, 10, 1.4, 0.5, 4)} fill={WHITE} /><path d={starPath(84, 30, 1.2, 0.4, 4)} fill={WHITE} />
        </g>
      );
    case "summer":
      return (
        <g>
          {SUMMER_STARS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.6" fill={WHITE} opacity="0.7" />)}
          {FIREFLIES.map(([x, y], i) => (
            <g key={i} className={styles.firefly} style={delay(i, 0.6)}>
              <circle cx={x} cy={y} r="3" fill="#FFF3A6" opacity="0.35" /><circle cx={x} cy={y} r="1.1" fill="#FFE866" />
            </g>
          ))}
        </g>
      );
    case "galaxy":
      return (
        <g>
          <path d="M-5 50 Q40 28 105 4 L105 18 Q50 36 -5 62 Z" fill="#B9B2EC" opacity="0.25" />
          {GALAXY_STARS.map(([x, y], i) => <circle key={i} className={styles.glint} style={delay(i, 0.4)} cx={x} cy={y} r={i % 3 ? 0.7 : 1} fill={WHITE} />)}
          <path d={starPath(40, 12, 2.4, 0.8, 4)} fill={GOLD} /><path d={starPath(80, 20, 2, 0.7, 4)} fill={GOLD} />
          <path className={styles.shoot} d="M86 6 L96 1" stroke={WHITE} strokeWidth="1" strokeLinecap="round" opacity="0" />
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
          <g fill="#F3D98A">
            {DUST.map(([x, y], i) => <circle key={i} className={styles.dust} style={delay(i, 0.45)} cx={x} cy={y - 18} r={i % 2 ? 0.9 : 1.2} />)}
          </g>
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
  goldbook: { aura: [84.5, 50, 12], sparks: [[74, 42, 2], [95, 46, 1.6]] },
  musicbox: { aura: [85, 47, 12], sparks: [[76, 40, 1.8], [94, 38, 1.5], [88, 34, 1.3]] },
} as const satisfies Record<string, { aura: readonly [number, number, number]; sparks: readonly Spark[] }>;
/** A 한정판 ground prop's small effect (10-07 A): the clover catches the light — one glint, still when light. */
const CLOVER_GLINT = starPath(21.5, 43, 1.8, 0.6, 4);

const FLAMES = [[28, 40, 9], [72, 40, 9], [37, 24, 7], [63, 24, 7], [50, 17, 8]] as const;
const flame = (x: number, y: number, h: number) =>
  `M${x} ${y} C ${x - h * 0.45} ${y - h * 0.35}, ${x - h * 0.2} ${y - h * 0.8}, ${x} ${y - h} C ${x + h * 0.2} ${y - h * 0.8}, ${x + h * 0.45} ${y - h * 0.35}, ${x} ${y} Z`;
const CLOUDS = [[23, 30, 1], [77, 30, -1], [30, 52, 0.8], [70, 52, -0.8]] as const;

/**
 * A 초판본 animal's own aura (10-07 사용자): behind the animal and soft, so the face stays as it is and the background
 * still reads — 청룡 blue clouds, 백호 silver wind, 주작 fire, 현무 water rings.
 */
function AnimalAura({ animal }: { animal: string }) {
  switch (animal) {
    case "bluedragon":
      return (
        <g data-part="animal-aura" data-aura="clouds" className={styles.aura} fill="#9ED3EA" opacity="0.7">
          {CLOUDS.map(([x, y, s], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${s} ${Math.abs(s)})`}>
              <circle cx="0" cy="0" r="4" /><circle cx="4.5" cy="1" r="3.2" /><circle cx="-4" cy="1.4" r="2.8" />
              <path d="M-6 4 q6 -3 12 0" stroke="#6CB7D8" strokeWidth="0.8" fill="none" />
            </g>
          ))}
        </g>
      );
    case "whitetiger":
      return (
        <g data-part="animal-aura" data-aura="wind" className={styles.aura} fill="none" strokeLinecap="round">
          <circle cx="50" cy="40" r="24" fill="#EEF2F8" opacity="0.5" />
          <g stroke="#C9D3E3" strokeWidth="1.4">
            <path d="M18 34 q10 -13 24 -11" /><path d="M82 34 q-10 -13 -24 -11" />
            <path d="M17 48 q8 -6 17 -4" /><path d="M83 48 q-8 -6 -17 -4" />
          </g>
        </g>
      );
    case "redbird":
      return (
        <g data-part="animal-aura" data-aura="fire" className={styles.flicker}>
          {FLAMES.map(([x, y, h], i) => (
            <g key={i}><path d={flame(x, y, h)} fill="#F28A3C" opacity="0.7" /><path d={flame(x, y - 1, h * 0.55)} fill="#F7D35E" opacity="0.85" /></g>
          ))}
        </g>
      );
    case "blacktortoise":
      return (
        <g data-part="animal-aura" data-aura="water" className={styles.aura} fill="none" stroke="#6FC0B5">
          <circle cx="50" cy="40" r="23" fill="#CDEBE5" stroke="none" opacity="0.45" />
          <ellipse cx="50" cy="60" rx="27" ry="5" strokeWidth="1" opacity="0.7" />
          <ellipse cx="50" cy="60" rx="18" ry="3.2" strokeWidth="0.9" opacity="0.8" />
        </g>
      );
    default:
      return null;
  }
}

function PropAura({ kind, aura }: { kind: string; aura: string }) {
  const fx = PROP_FX[kind as keyof typeof PROP_FX];
  return fx ? <circle className={styles.aura} cx={fx.aura[0]} cy={fx.aura[1]} r={fx.aura[2]} fill={`url(#${aura})`} /> : null;
}
function PropSparkles({ kind }: { kind: string }) {
  const fx = PROP_FX[kind as keyof typeof PROP_FX];
  return fx ? <Sparkles points={fx.sparks} /> : null;
}

/**
 * A prop drawn alone (도감 소품 칸, its silhouette) is moved to the middle and enlarged: [centre x, centre y, scale] of
 * where it sits in the full picture. Props spread over the window (grass, flowers) stay nearly as they are.
 */
const PROP_FOCUS: Readonly<Record<string, readonly [number, number, number]>> = {
  grass: [50, 52, 1], flowers: [50, 51, 1], books: [85.5, 49.5, 1.6], mushroom: [14.5, 51, 1.6], clover: [16.3, 49, 1.6],
  teacup: [15, 47, 1.5], jar: [85, 48, 1.5], quill: [86.5, 43, 1.25], goldbook: [84.5, 50.5, 1.5], musicbox: [85, 48.5, 1.5],
};
export function propFocus(value: string): string | undefined {
  const f = PROP_FOCUS[value];
  return f ? `translate(50 ${f[1]}) scale(${f[2]}) translate(${-f[0]} ${-f[1]})` : undefined;
}

/**
 * C-03 — the background (its sky, its living details, its hill), the animal at 55% sitting on the hill, one ground prop.
 * Three parts (10-07 A): there is no sky prop — the sky belongs to the background. Decorative only.
 * 초판본 parts (도감 v1, rare-art.html · first-edition-effects.gif): a gold rim on the window and a light sweep now and then;
 * an animal gets a breathing aura + four sparkles, a prop a glow + two sparkles; a 초판본 background is living (BackDetail).
 * A 한정판 ground prop (the clover) has one small glint. `fx="light"` (a moving or small bookmark — T-03, the rods, the
 * 도감) and prefers-reduced-motion keep everything still: the rim, a still aura, the living backgrounds as a still picture.
 * Ids (clip, gradients) are `clipId` + this instance's useId(): the same book drawn twice on one page (a rod and its
 * sheet, the drag copy) never shares a clip or gradient.
 * `parts` (도감 칸, 10-05): which parts are shown — the sky and hill of `art.bg` are always the stage; the animal and the
 * prop only when listed. The tier (rim, `data-tier`) and the 초판본 effects follow the listed parts only. A prop alone is
 * centred and enlarged (PROP_FOCUS). `stage={false}` (도감 동물·소품 칸, 10-07 — the part alone, to stand out): no sky, no
 * background details, no hill; the window's own background shows through.
 */
export function BookmarkArt({ art, clipId: base, fx = "full", parts = ART_KINDS, stage = true }: {
  art: ArtCombo; clipId: string; fx?: "full" | "light"; parts?: readonly ArtKind[]; stage?: boolean;
}) {
  const clipId = `${base}-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const bg = BACKGROUNDS[art.bg] ?? BACKGROUNDS.peach;
  const shows = (kind: ArtKind) => parts.includes(kind);
  const first = (kind: ArtKind) => shows(kind) && tierOf(kind, art[kind]) === "first_edition";
  const tier = highestTier(parts.map((kind) => tierOf(kind, art[kind]) ?? "common"));
  const lone = parts.length === 1 && parts[0] === "ground" ? propFocus(art.ground) : undefined;
  // The gold rim and the light sweep belong to the background (10-07 사용자): only a drawn 초판본 background has them.
  const gilded = stage && tierOf("bg", art.bg) === "first_edition";
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
        {stage && art.bg === "sunset" && (
          <linearGradient id={sun} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9C7BB8" /><stop offset="0.55" stopColor="#F09A7A" /><stop offset="1" stopColor="#F8C98A" />
          </linearGradient>
        )}
        {first("ground") && (
          <radialGradient id={aura}>
            <stop offset="0" stopColor="#FFE29A" stopOpacity="0.95" /><stop offset="0.6" stopColor="#F3C861" stopOpacity="0.35" />
            <stop offset="1" stopColor="#F3C861" stopOpacity="0" />
          </radialGradient>
        )}
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {stage && <rect width="100" height="76" fill={art.bg === "sunset" ? `url(#${sun})` : bg.sky} />}
        {stage && <g data-part="living"><BackDetail kind={art.bg} /></g>}
        {stage && <path d={HILL} fill={bg.hill} />}
        {shows("animal") && (
          <>
            {first("animal") && <AnimalAura animal={art.animal} />}
            <image href={`/animals/${art.animal}.svg`} x="22.5" y="12" width="55" height="55" />
            {full && first("animal") && <Sparkles points={ANIMAL_SPARKS} />}
          </>
        )}
        {shows("ground") && (
          <g transform={lone}>
            {first("ground") && <PropAura kind={art.ground} aura={aura} />}
            <Ground kind={art.ground} />
            {first("ground") && full && <PropSparkles kind={art.ground} />}
            {art.ground === "clover" && <path className={styles.glint} data-part="glint" d={CLOVER_GLINT} fill={SPARK} />}
          </g>
        )}
        {full && gilded && (
          <g transform="skewX(-20)"><rect className={styles.sweep} x="-30" y="-10" width="16" height="100" fill="#FFF6D6" opacity="0.35" /></g>
        )}
        {gilded && (
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
 * 도감 못 만난 칸 (시안 ①②): the part's shape alone, drawn flat by the cell's CSS (a silhouette) — a prop centred and
 * enlarged as its met cell draws it. Backgrounds have no shape of their own — a plain arch and the "?". Decorative.
 */
export function PartShape({ kind, value, className }: { kind: ArtKind; value: string; className?: string }) {
  if (kind === "animal") {
    // eslint-disable-next-line @next/next/no-img-element -- a 100 × 100 SVG drawn flat by CSS; no optimisation to gain
    return <img className={className} src={`/animals/${value}.svg`} alt="" aria-hidden="true" draggable={false} />;
  }
  if (kind === "bg" || value === "none") return null;
  return (
    <svg className={className} viewBox="0 0 100 76" aria-hidden="true" focusable="false">
      <g transform={propFocus(value)}><Ground kind={value as GroundProp} /></g>
    </svg>
  );
}
