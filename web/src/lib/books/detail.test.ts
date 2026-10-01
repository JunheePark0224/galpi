import { describe, expect, it } from "vitest";
import kakao from "./__fixtures__/kakao-search.json";
import yes24 from "./__fixtures__/yes24-detail.json";
import { cleanIntro, emptyDetail, fromKakao, fromYes24, yes24SearchUrl } from "./detail";

// Synthetic fixtures with the real response shapes (field names checked against cached YES24 detail responses) — no real YES24 text.
const ISBN = "9790000000001";
const item = yes24.data.items[0];
const withItem = (patch: Record<string, unknown>) => ({ ...yes24, data: { ...yes24.data, items: [{ ...item, ...patch }] } });

describe("cleanIntro", () => {
  it("removes tags, entities, CRLF and indent markers, keeping words and paragraphs", () => {
    expect(cleanIntro("<b>굵게</b> 글<br/>다음 줄\r\n\r\n\r\n__둘째 문단 &quot;인용&quot; &amp; &#44032;&#xAC01;"))
      .toBe("굵게 글\n다음 줄\n\n둘째 문단 \"인용\" & 가각");
  });
  it("keeps an unknown or invalid entity as written", () => {
    expect(cleanIntro("&unknown; &#0; &#xD800;")).toBe("&unknown; &#0; &#xD800;");
  });
  it("turns a closing </p> into a paragraph break and squeezes inner spaces", () => {
    expect(cleanIntro("<p>하나   둘</p><p>셋</p>")).toBe("하나 둘\n\n셋");
  });
});

describe("fromYes24", () => {
  it("normalises the detail response (https cover, sale price, star score, pages, clean intro, product link)", () => {
    const d = fromYes24(yes24, ISBN);
    expect(d).toMatchObject({
      source: "yes24",
      cover: "https://image.yes24.com/goods/10000001/L",
      price: 14400,
      rating: 9.4,
      pages: 280,
      link: "https://www.yes24.com/product/goods/10000001",
    });
    expect(d?.intro.startsWith("보내지 못한 편지는 어디로 갈까?\n여름마다 열리는 작은 우편함\n\n이 소개는")).toBe(true);
    expect(d?.intro.endsWith("\"편지는 늦게 와도 도착한다\" & 그 밖의 이야기.")).toBe(true);
    expect(d?.intro).not.toMatch(/<|&quot;|\r|__/);
  });
  it("treats a 0 star score (no ratings yet) as no rating", () => {
    expect(fromYes24(withItem({ starScore: 0 }), ISBN)?.rating).toBeNull();
  });
  it("drops a cover or link on a host we do not expect, keeping the search link", () => {
    const d = fromYes24(withItem({ cover: "https://evil.example/x.jpg", link: "javascript:alert(1)" }), ISBN);
    expect(d).toMatchObject({ cover: null, link: yes24SearchUrl(ISBN) });
    expect(fromYes24(withItem({ cover: "not a url" }), ISBN)?.cover).toBeNull();
  });
  it("is null for a failure, an empty list or another book", () => {
    expect(fromYes24({ success: false, errorCode: "E01" }, ISBN)).toBeNull();
    expect(fromYes24({ success: true, data: { items: [] } }, ISBN)).toBeNull();
    expect(fromYes24(yes24, "9790000000002")).toBeNull();
    expect(fromYes24("<html>", ISBN)).toBeNull();
    expect(fromYes24(null, ISBN)).toBeNull();
  });
  it("gives an empty intro when contentDetail is missing", () => {
    expect(fromYes24(withItem({ contentDetail: null }), ISBN)?.intro).toBe("");
  });
});

describe("fromKakao", () => {
  it("takes only the cover and the price (PRD F-14), links to the YES24 search", () => {
    expect(fromKakao(kakao, ISBN)).toEqual({
      source: "kakao",
      cover: "https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=test",
      price: 14400,
      rating: null,
      pages: null,
      intro: "",
      link: yes24SearchUrl(ISBN),
    });
  });
  it("falls back to the list price when there is no sale price (-1)", () => {
    const doc = { ...kakao.documents[0], sale_price: -1 };
    expect(fromKakao({ ...kakao, documents: [doc] }, ISBN)?.price).toBe(16000);
  });
  it("is null when the ISBN is not there or nothing useful came back", () => {
    expect(fromKakao(kakao, "9790000000002")).toBeNull();
    const bare = { ...kakao.documents[0], thumbnail: "", sale_price: -1, price: 0 };
    expect(fromKakao({ documents: [bare] }, ISBN)).toBeNull();
    expect(fromKakao({ errorType: "AccessDeniedError" }, ISBN)).toBeNull();
  });
});

describe("emptyDetail", () => {
  it("still links to YES24 so [예스24에서 보기] always works", () => {
    expect(emptyDetail(ISBN)).toEqual({
      source: null, cover: null, price: null, rating: null, pages: null, intro: "",
      link: "https://www.yes24.com/Product/Search?domain=BOOK&query=9790000000001",
    });
  });
});
