import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseQuestionMap } from "./parse";
import { validateMap, type Vocabulary } from "./validate";

const MINI = readFileSync(path.join(process.cwd(), "src/lib/paths/__fixtures__/mini-map.md"), "utf8");
const VOCAB: Vocabulary = {
  topics: { "데이터 분석": ["SQL", "엑셀"], "마음 돌보기": ["우울"] },
  genres: ["한국 소설", "외국 소설", "에세이", "시", "SF·판타지", "인문", "과학 교양", "데이터 분석", "마음 돌보기"],
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
    expect(validateMap(edit("temp=+1", "mode=challenge"), VOCAB)).toContain("mood-temp: A is a mood question but switches the mode");
  });
  it("names an unsure that goes nowhere and far tags that are not ours", () => {
    expect(validateMap(edit("unsure: next=mood-way", "unsure: next=nowhere"), VOCAB)).toContain('learn-area: unsure goes to unknown node "nowhere"');
    expect(validateMap(edit("genres=인문\n", "genres=무협\n"), VOCAB)).toContain('far 1 to: genre "무협" is not one of ours');
    expect(validateMap(edit("from: entry=target | topics=데이터 분석", "from: topics=요리"), VOCAB)).toContain('far 1 from: topic "요리" is not one of ours');
  });
  it("names a far rule that can never win because an earlier rule covers it (the first rule wins)", () => {
    const far = (...froms: string[]) => parseQuestionMap(froms.reduce((md, f) => `${md}\n\`\`\`far\nfrom: ${f}\nto: entry=leaf | genres=인문\n\`\`\``, MINI));
    const errors = (...froms: string[]) => validateMap(far(...froms), VOCAB);
    expect(errors("entry=target | topics=데이터 분석 | keywords=SQL")).toEqual(["far 2 is shadowed by far 1"]);
    expect(errors("entry=target")).toEqual([]);                                         // wider rule below a narrow one: fine
    expect(errors("entry=leaf | topics=데이터 분석")).toEqual([]);                        // another entry
    expect(errors("genres=SF·판타지", "genres=SF·판타지,에세이", "genres=SF·판타지")).toEqual(["far 4 is shadowed by far 2"]);
  });

  it("challenge rules v2: a 배우기 far rule goes only to 과학 교양·인문·역사·예술·여행·사회·시사", () => {
    const learn = (to: string) => validateMap(parseQuestionMap(`${MINI}\n\`\`\`far\nfrom: entry=target\nto: ${to}\n\`\`\``), VOCAB);
    expect(learn("entry=leaf | genres=인문,과학 교양")).toEqual([]);
    expect(learn("entry=leaf | genres=시")).toEqual(['far 2: a 배우기 challenge may not go to "시" (only 과학 교양·인문·역사·예술·여행·사회·시사)']);
    expect(learn("entry=leaf | genres=인문,에세이,SF·판타지")).toEqual([
      'far 2: a 배우기 challenge may not go to "에세이" (only 과학 교양·인문·역사·예술·여행·사회·시사)',
      'far 2: a 배우기 challenge may not go to "SF·판타지" (only 과학 교양·인문·역사·예술·여행·사회·시사)',
    ]);
    const shape = "far 2: a 배우기 challenge must go to entry=leaf | genres= of 과학 교양·인문·역사·예술·여행·사회·시사";
    expect(learn("entry=leaf")).toEqual([shape]);                                       // no genres named
    expect(learn("genres=인문")).toEqual([shape]);                                      // no entry
    expect(learn("entry=leaf | genres=인문 | topics=마음 돌보기")).toEqual([shape]);
    expect(learn("entry=leaf | genres=인문 | keywords=SQL")).toEqual([shape]);
    // a 이야기 rule is not a 배우기 challenge: it may go to 시
    expect(validateMap(parseQuestionMap(`${MINI}\n\`\`\`far\nfrom: entry=leaf\nto: entry=leaf | genres=시\n\`\`\``), VOCAB)).toEqual([]);
  });
});
