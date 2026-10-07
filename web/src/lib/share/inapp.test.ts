import { describe, expect, it } from "vitest";
import { isKakaoInApp, mineUrl, openOutside } from "./inapp";

const KAKAO_ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S921N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 KAKAOTALK/25.8.0 (INAPP)";
const KAKAO_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 25.8.0";
const CHROME = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";

describe("KakaoTalk's in-app browser — no share sheet, no downloads (F-27, 10-07)", () => {
  it("knows the KakaoTalk in-app browser on Android and iPhone, and nothing else", () => {
    expect(isKakaoInApp(KAKAO_ANDROID)).toBe(true);
    expect(isKakaoInApp(KAKAO_IOS)).toBe(true);
    expect(isKakaoInApp(CHROME)).toBe(false);
    expect(isKakaoInApp("")).toBe(false);
  });

  it("asks KakaoTalk to open the person's own back cover in the phone's browser", () => {
    const own = mineUrl("https://www.galpibook.com/s/1~0A~a~000");
    expect(own).toBe("https://www.galpibook.com/s/1~0A~a~000?mine=1");
    expect(openOutside(own)).toBe(`kakaotalk://web/openExternal?url=${encodeURIComponent(own)}`);
  });
});
