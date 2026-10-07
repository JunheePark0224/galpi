import { describe, expect, it } from "vitest";
import { bibFromCsv, cleanAuthor, normalizeBook, normalizeCatalog, normalizeVocab, parseCsv } from "./normalize";
import { TOPICS } from "./taxonomy";

const BIB = new Map([
  ["9791111111111", { title: "모순", author: "양귀자" }],
  ["9792222222222", { title: "처음 만나는 SQL", author: "김하늘, 이바다" }],
]);
const leafRow = {
  isbn: "9791111111111", entry: "leaf", slot: "한국 소설", field: null, topic: null, genre: "한국 소설", pages: 308, way: null,
  axes: { temp: 1, pull: -1, gain: 0, world: 1 }, keywords: [], one_liner: "사랑과 현실 사이에서 무엇을 고를까요?", one_liner_style: "question",
};
const targetRow = {
  isbn: "9792222222222", entry: "target", slot: "데이터 분석", field: "데이터·통계", topic: "데이터 분석", genre: "데이터 분석", pages: 240,
  way: "실습", axes: null, keywords: ["SQL", "시각화"], one_liner: "표에서 원하는 줄만 꺼내는 쿼리를 익혀요", one_liner_style: "summary",
};

describe("normalizeBook", () => {
  it("keeps a 🍃 row with its title and axes", () => {
    expect(normalizeBook(leafRow, BIB)).toEqual({
      isbn: "9791111111111", entry: "leaf", title: "모순", author: "양귀자", genre: "한국 소설", field: null, topic: null, pages: 308, way: null,
      axes: { temp: 1, pull: -1, gain: 0, world: 1 }, keywords: [], one_liner: "사랑과 현실 사이에서 무엇을 고를까요?", one_liner_style: "question",
    });
  });

  it("derives field and genre of a 🎯 row from its topic", () => {
    const b = normalizeBook({ ...targetRow, field: undefined, genre: undefined }, BIB);
    expect(b).toMatchObject({
      entry: "target", title: "처음 만나는 SQL", author: "김하늘, 이바다", topic: "데이터 분석", genre: "데이터 분석", field: "데이터·통계",
      way: "실습", axes: null, keywords: ["SQL", "시각화"],
    });
  });

  it("accepts the D-A genres (no books yet — the pipeline adds them)", () => {
    expect(normalizeBook({ ...leafRow, slot: "호러·괴담" }, BIB)).toMatchObject({ entry: "leaf", genre: "호러·괴담" });
  });

  it("derives the new fields of the D-A topics", () => {
    expect(normalizeBook({ ...targetRow, slot: "돈 관리·투자", keywords: ["주식"] }, BIB)).toMatchObject({
      topic: "돈 관리·투자", genre: "돈 관리·투자", field: "돈·경제", keywords: ["주식"],
    });
  });

  it("accepts 로맨스 and the four 10-05 topics, which take the 일·커리어 and 습관·자기계발 fields", () => {
    expect(normalizeBook({ ...leafRow, slot: "로맨스" }, BIB)).toMatchObject({ entry: "leaf", genre: "로맨스", field: null });
    for (const [topic, field, keyword] of [
      ["마케팅·브랜딩", "일·커리어", "브랜딩"], ["리더십", "일·커리어", "피드백·코칭"], ["건강·운동", "습관·자기계발", "잠·회복"], ["요리·살림", "습관·자기계발", "집밥"],
    ]) {
      expect(normalizeBook({ ...targetRow, slot: topic, field: undefined, genre: undefined, keywords: [keyword] }, BIB)).toMatchObject({ topic, genre: topic, field, keywords: [keyword] });
    }
  });

  it("keeps an empty axis (null, 비움 — label-dictionary v3.1 rule 9) as null", () => {
    expect(normalizeBook({ ...leafRow, axes: { temp: null, pull: 0, gain: -1, world: 1 } }, BIB).axes)
      .toEqual({ temp: null, pull: 0, gain: -1, world: 1 });
  });

  it("accepts Korean one-liner style names", () => {
    expect(normalizeBook({ ...targetRow, one_liner_style: "요약형" }, BIB).one_liner_style).toBe("summary");
  });

  it.each([
    ["an unknown genre", { ...leafRow, slot: "요리" }, /unknown leaf genre/],
    ["an axis outside -1..1", { ...leafRow, axes: { temp: 2, pull: 0, gain: 0, world: 0 } }, /axis temp/],
    ["a missing axis (only null is empty)", { ...leafRow, axes: { temp: 1, pull: 0, gain: 0 } }, /axis world/],
    ["a missing title", { ...leafRow, isbn: "9793333333333" }, /no title/],
    ["a bad isbn", { ...leafRow, isbn: "12" }, /13 digits/],
    ["an unknown way", { ...targetRow, way: "독학" }, /way must be/],
    ["an empty one-liner", { ...targetRow, one_liner: "  " }, /one_liner is empty/],
    ["an unknown entry", { ...targetRow, entry: "shelf" }, /unknown entry/],
    ["zero pages", { ...targetRow, pages: 0 }, /pages/],
  ])("rejects %s", (_, row, message) => {
    expect(() => normalizeBook(row, BIB)).toThrow(message);
  });

  it("rejects a book whose author is empty after cleaning", () => {
    const bib = new Map([["9791111111111", { title: "모순", author: "" }]]);
    expect(() => normalizeBook(leafRow, bib)).toThrow(/no author/);
  });
});

describe("normalizeCatalog", () => {
  it("accepts a list or an isbn-keyed object", () => {
    expect(normalizeCatalog([leafRow, targetRow], BIB)).toHaveLength(2);
    const { isbn, ...rest } = leafRow;
    expect(normalizeCatalog({ [isbn]: rest }, BIB)[0].isbn).toBe(isbn);
  });

  it("rejects duplicates and empty sources", () => {
    expect(() => normalizeCatalog([leafRow, leafRow], BIB)).toThrow(/duplicate isbn/);
    expect(() => normalizeCatalog([], BIB)).toThrow(/no books/);
  });
});

describe("CSV titles and authors", () => {
  it("reads quoted titles with commas and a BOM", () => {
    const csv = "﻿entry,slot,title,author,isbn\r\nleaf,시,\"꽃, 그리고 \"\"나\"\"\",\"천선란,임솔아 저\",9791111111111\nleaf,시,모순,양귀자 저,9792222222222\n";
    expect(parseCsv(csv)[1]).toEqual(["leaf", "시", "꽃, 그리고 \"나\"", "천선란,임솔아 저", "9791111111111"]);
    expect(bibFromCsv(csv).get("9791111111111")).toEqual({ title: "꽃, 그리고 \"나\"", author: "천선란, 임솔아" });
    expect(bibFromCsv(csv).get("9792222222222")).toEqual({ title: "모순", author: "양귀자" });
  });

  it("needs isbn, title and author columns", () => {
    expect(() => bibFromCsv("isbn,title\n1,2\n")).toThrow(/isbn, title and author/);
  });
});

describe("cleanAuthor", () => {
  it.each([
    ["양귀자 저", "양귀자"],
    ["김수현 저 ", "김수현"],
    ["조지 오웰 저/정회성 역", "조지 오웰"],
    ["라이먼 프랭크 바움 저/윌리엄 월리스 덴슬로우 그림/손인혜 역", "라이먼 프랭크 바움"],
    ["권정민 글/주형 만화", "권정민"],
    ["지현이(디지털거북이) 저", "지현이"],
    ["아디티 네루카(Aditi Nerurkar, MD) 저/박미경 역", "아디티 네루카"],
    ["천선란,임솔아 저", "천선란, 임솔아"],
    ["마경근,서주란 공저", "마경근, 서주란"],
    ["기시미 이치로,고가 후미타케 저/전경아 역/김정운 감수", "기시미 이치로 외"],
    ["피터 브루스, 앤드루 브루스, 피터 게데크 저/이준용 역", "피터 브루스 외"],
    ["배명은 등저", "배명은 외"],
    ["Dave Lee 저", "Dave Lee"],
    ["루키우스 안나이우스 세네카 저/하와이 대저택 편역", "루키우스 안나이우스 세네카"],
    ["", ""],
  ])("%s → %s", (raw, clean) => {
    expect(cleanAuthor(raw)).toBe(clean);
  });
});

describe("normalizeVocab", () => {
  const topic = (kept: Record<string, { pattern: string }>) => ({ kept, folded: { 파이썬: 4 }, too_common: { 시각화: 11 } });
  const raw: Record<string, ReturnType<typeof topic>> = {
    ...Object.fromEntries(TOPICS.map((t) => [t, topic({})])), "데이터 분석": topic({ SQL: { pattern: "SQL|쿼리" } }),
  };

  it("keeps kept patterns as keywords and folded / too-common names as topic words", () => {
    expect(normalizeVocab(raw)["데이터 분석"]).toEqual({ keywords: { SQL: "SQL|쿼리" }, terms: ["파이썬", "시각화"] });
  });

  it("rejects a missing topic and a broken pattern", () => {
    const missing = Object.fromEntries(Object.entries(raw).filter(([name]) => name !== "통계"));
    expect(() => normalizeVocab(missing)).toThrow(/no topic 통계/);
    expect(() => normalizeVocab({ ...raw, 통계: topic({ 확률: { pattern: "(" } }) })).toThrow(/통계\/확률/);
  });
});
