import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Book, TargetBook } from "@/lib/recommend";
import { coverage, pathEnds } from "./coverage";
import { parseQuestionMap } from "./parse";

const MAP = parseQuestionMap(readFileSync(path.join(process.cwd(), "src/lib/paths/__fixtures__/mini-map.md"), "utf8"));
const t = (id: string, k: string): TargetBook => ({ id, entry: "target", field: "f", topic: "데이터 분석", genre: "데이터 분석", pages: 200, way: "실습", keywords: [k] });

describe("pathEnds", () => {
  it("lists each distinct end once per mode, with a way to reach it", () => {
    const ends = pathEnds(MAP);
    const normal = ends.filter((e) => e.mode === "normal").map((e) => e.scopeKey);
    expect(normal).toEqual(expect.arrayContaining([
      "all", "entry=leaf", "entry=target", "entry=target;topics=데이터 분석;keywords=SQL",
      "entry=target;topics=데이터 분석;keywords=엑셀", "entry=leaf;genres=SF·판타지",
    ]));
    expect(new Set(normal).size).toBe(normal.length);
    const sql = ends.find((e) => e.mode === "normal" && e.scopeKey.endsWith("keywords=SQL"))!;
    expect(sql.crumbs).toEqual(["뭔가 배우기", "데이터를 다루기", "DB에서 꺼내기"]);
    expect(sql.example.at(-1)).toEqual({ node: "mood-len", choice: "unsure" });
  });

  it("lists the challenge ends: far scopes, and the whole library stays whole", () => {
    const challenge = pathEnds(MAP).filter((e) => e.mode === "challenge").map((e) => e.scopeKey);
    expect(challenge).toEqual(expect.arrayContaining(["all", "entry=leaf;genres=에세이", "entry=leaf", "entry=target"]));
    expect(new Set(challenge).size).toBe(challenge.length);
  });
});

describe("coverage", () => {
  it("counts the books at every end, fewest first", () => {
    const books: Book[] = [t("1", "SQL"), t("2", "SQL"), t("3", "엑셀")];
    const rows = coverage(MAP, books).filter((r) => r.mode === "normal");
    expect(rows[0].books).toBe(0);
    expect(rows.find((r) => r.scopeKey.endsWith("keywords=SQL"))!.books).toBe(2);
    expect(rows.map((r) => r.books)).toEqual([...rows.map((r) => r.books)].sort((x, y) => x - y));
  });
});
