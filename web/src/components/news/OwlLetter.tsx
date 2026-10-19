/**
 * DESIGN C-33: the A-01 owl (`assets/animals/owl.svg`, same faces and colours) holding a cream letter with a red seal in its
 * beak. Decorative (aria-hidden): the words are on the button or the sheet. Nothing moves.
 */
export function OwlLetter({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path d="M30 42 L32 30 L42 38 Z M70 42 L68 30 L58 38 Z" fill="#A7876B" />
      <circle cx="50" cy="63" r="26" fill="#A7876B" />
      <circle cx="39" cy="58" r="9" fill="#F5EEDD" />
      <circle cx="61" cy="58" r="9" fill="#F5EEDD" />
      <circle cx="39" cy="58" r="3.4" fill="#2B2724" />
      <circle cx="61" cy="58" r="3.4" fill="#2B2724" />
      <ellipse cx="50" cy="80" rx="12" ry="5" fill="#F5EEDD" opacity=".5" />
      <g transform="rotate(-14 62 80)">
        <rect x="46" y="68" width="34" height="23" rx="1.5" fill="#fffdf7" stroke="#8C6B2E" strokeWidth="1.4" />
        <path d="M46.7 68.7 L63 80 L79.3 68.7" fill="none" stroke="#8C6B2E" strokeWidth="1.4" strokeLinejoin="round" />
        <circle cx="63" cy="80.5" r="2.6" fill="#b23a48" />
      </g>
      <path d="M47 64 H53 L50 69.5 Z" fill="#E39A4E" />
    </svg>
  );
}
