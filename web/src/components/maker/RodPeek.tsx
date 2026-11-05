/**
 * DESIGN C-35: a short leather rod with three small bookmarks hanging from it (C-02 arch and swallowtail, frost film) —
 * peach · aurora · leaf windows with a cat, a rabbit and a fox (A-01 faces, simplified). Decorative (aria-hidden): the
 * words are on the button. Nothing moves.
 */
export function RodPeek({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 64" aria-hidden="true" focusable="false">
      <rect x="6" y="6" width="88" height="4.5" rx="2.2" fill="#5A3420" />
      <circle cx="6" cy="8.2" r="3.2" fill="#7A4A2E" />
      <circle cx="94" cy="8.2" r="3.2" fill="#7A4A2E" />
      <g stroke="#7A6048" strokeWidth="1.3">
        <line x1="24" y1="10.5" x2="24" y2="17" />
        <line x1="50" y1="10.5" x2="50" y2="17" />
        <line x1="76" y1="10.5" x2="76" y2="17" />
      </g>
      <g stroke="#DDD0B4" strokeWidth="1" fill="#F4F1EA">
        <path d="M13 27 A11 11 0 0 1 35 27 V60 L24 54 L13 60 Z" />
        <path d="M39 27 A11 11 0 0 1 61 27 V60 L50 54 L39 60 Z" />
        <path d="M65 27 A11 11 0 0 1 87 27 V60 L76 54 L65 60 Z" />
      </g>
      <path d="M15.5 27.5 A8.5 8.5 0 0 1 32.5 27.5 V40 H15.5 Z" fill="#F9DCCB" />
      <path d="M15.5 37 Q24 33 32.5 37 V40 H15.5 Z" fill="#E7B597" />
      <path d="M41.5 27.5 A8.5 8.5 0 0 1 58.5 27.5 V40 H41.5 Z" fill="#1D2E4A" />
      <path d="M43 26 Q50 22 57 27" stroke="#7FD6B0" strokeWidth="1.6" fill="none" opacity=".8" />
      <path d="M41.5 37 Q50 33 58.5 37 V40 H41.5 Z" fill="#2C4440" />
      <path d="M67.5 27.5 A8.5 8.5 0 0 1 84.5 27.5 V40 H67.5 Z" fill="#E4EFD9" />
      <path d="M67.5 37 Q76 33 84.5 37 V40 H67.5 Z" fill="#A9C69A" />
      {/* cat */}
      <g transform="translate(17 23) scale(.14)">
        <path d="M26 52 L29 24 Q31 20 35 23 L48 36 Z M74 52 L71 24 Q69 20 65 23 L52 36 Z" fill="#EFE3CF" />
        <ellipse cx="50" cy="61" rx="27" ry="24" fill="#EFE3CF" />
        <circle cx="40" cy="60" r="3" fill="#2B2724" /><circle cx="60" cy="60" r="3" fill="#2B2724" />
      </g>
      {/* rabbit */}
      <g transform="translate(43 22) scale(.14)">
        <ellipse cx="40" cy="26" rx="7.5" ry="20" fill="#F6F0E4" /><ellipse cx="60" cy="26" rx="7.5" ry="20" fill="#F6F0E4" />
        <ellipse cx="40" cy="27" rx="3.4" ry="14" fill="#EBB7AA" /><ellipse cx="60" cy="27" rx="3.4" ry="14" fill="#EBB7AA" />
        <circle cx="50" cy="63" r="25" fill="#F6F0E4" />
        <circle cx="41" cy="61" r="2.8" fill="#2B2724" /><circle cx="59" cy="61" r="2.8" fill="#2B2724" />
      </g>
      {/* fox */}
      <g transform="translate(69 23) scale(.14)">
        <path d="M24 50 L27 24 Q28 20 32 22 L46 36 Z M76 50 L73 24 Q72 20 68 22 L54 36 Z" fill="#D98C55" />
        <path d="M22 52 Q50 26 78 52 Q74 76 50 86 Q26 76 22 52 Z" fill="#D98C55" />
        <path d="M23 57 Q37 61 50 86 Q29 80 23 57 Z M77 57 Q63 61 50 86 Q71 80 77 57 Z" fill="#FBF4E8" />
        <circle cx="40" cy="58" r="3" fill="#2B2724" /><circle cx="60" cy="58" r="3" fill="#2B2724" />
      </g>
      <g fill="#DDD0B4">
        <rect x="16" y="44" width="16" height="1.6" rx=".8" /><rect x="42" y="44" width="16" height="1.6" rx=".8" /><rect x="68" y="44" width="16" height="1.6" rx=".8" />
        <rect x="18" y="48" width="12" height="1.4" rx=".7" /><rect x="44" y="48" width="12" height="1.4" rx=".7" /><rect x="70" y="48" width="12" height="1.4" rx=".7" />
      </g>
    </svg>
  );
}
