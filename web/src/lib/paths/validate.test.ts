import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseQuestionMap } from "./parse";
import { validateMap, type Vocabulary } from "./validate";

const MINI = readFileSync(path.join(__dirname, "__fixtures__/mini-map.md"), "utf8");
const VOCAB: Vocabulary = {
  topics: { "데이터 분석": ["SQL", "엑셀"], "마음 돌보기": ["우울"] },
  genres: ["한국 소설", "외국 소설", "에세이", "SF·판타지", "데이터 분석", "마음 돌보기"],
};
const edit = (from: string, to: string) => parseQuestionMap(MINI.replace(from, to));

describe("validateMap", () => {
  it("passes the mini map", () => {
    expect(validateMap(parseQuestionMap(MINI), VOCAB)).toEqual([]);
  });
  it("names a next that goes nowhere and a node nobody reaches", () => {
    expect(validateMap(edit("next=mood-way\nB: 표로", "next=nowhere\nB: 표로"), VOCAB)).toContain('learn-data: A goes to unknown node "nowhere"');
    const orphan = parseQuestionMap(`${MINI}\n\`\`\`node\nid: lost\nkind: mood\nquestion: q\nA: a | next=draw\nB: b | next=draw\nunsure: next=draw\n\`\`\``);
    expect(validateMap(orphan, VOCAB)).toContain("lost: not reachable from the start");
  });
  it("names a loop", () => {
    expect(validateMap(edit("A: 가볍게 한 권 | len=+1 | next=draw", "A: 가볍게 한 권 | len=+1 | next=start"), VOCAB).join(" ")).toMatch(/loop/);
  });
  it("names tags that are not ours, or a keyword outside the topic chosen on the way", () => {
    expect(validateMap(edit("topics=마음 돌보기", "topics=요리"), VOCAB)).toContain('learn-area: B topic "요리" is not one of ours');
    expect(validateMap(edit("keywords=엑셀", "keywords=우울"), VOCAB)).toContain('learn-data: B keyword "우울" is not in 데이터 분석');
    expect(validateMap(edit("genres=SF·판타지", "genres=무협"), VOCAB)).toContain('story-world: B genre "무협" is not one of ours');
  });
  it("keeps the two kinds apart: mood nodes set no scope, narrow nodes set no mood", () => {
    expect(validateMap(edit("temp=+1", "genres=에세이"), VOCAB)).toContain("mood-temp: A is a mood question but changes the scope");
    expect(validateMap(edit("keywords=SQL", "keywords=SQL | len=+1"), VOCAB)).toContain("learn-data: A is a narrow question but sets a mood");
  });
});
