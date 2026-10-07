/** DESIGN T-06 for Motion, in seconds — keep in step with tokens.css (--dur-*, --ease-*). */
export const OPEN_COVER = { duration: 1, ease: [0.6, 0.05, 0.25, 1] } as const;
/** S-11 (10-07): the book shuts the way it opened, after the last bookmark has gone (BOOKMARK_AWAY/DOWN ≈ 0.4 s). */
export const SHUT_BOOK = { ...OPEN_COVER, delay: 0.4 } as const;
/** …then, shut, it settles to a book's size on a phone (Book.module.css `.zoom[data-shut]`, the same 0.45 s) before the bookmarks lie on it. */
export const SHUT_SETTLE_MS = 450;
export const FLIP_PAGE = { duration: 0.55, ease: [0.5, 0, 0.3, 1] } as const;
export const BOOKMARK_RISE = { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] } as const;
export const BOOKMARK_AWAY = { duration: 0.45, ease: "easeIn" } as const;
export const BOOKMARK_DOWN = { duration: 0.4, ease: "easeIn" } as const;
