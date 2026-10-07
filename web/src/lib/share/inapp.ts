/**
 * KakaoTalk opens links in its own browser, which has no share sheet (navigator.share) on Android and does not download
 * files — so 공유하기 and 이미지로 공유 cannot work there (10-07, a real share test). KakaoTalk can hand a page to the phone's
 * own browser through its `kakaotalk://web/openExternal` link; we hand over the person's own back cover (`?mine=1`).
 */
export function isKakaoInApp(userAgent: string): boolean {
  return /KAKAOTALK/i.test(userAgent);
}

/** The person's own back cover at its share address — S-12 with the share buttons instead of [나도 갈피 잡기]. */
export function mineUrl(shareUrl: string): string {
  return `${shareUrl}?mine=1`;
}

export function openOutside(url: string): string {
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
}
