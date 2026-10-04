import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MapParseError, parseQuestionMap } from "./parse";

const MINI = readFileSync(path.join(process.cwd(), "src/lib/paths/__fixtures__/mini-map.md"), "utf8");

describe("parseQuestionMap", () => {
  it("reads every node block, the first one is the start, and the far rules", () => {
    const map = parseQuestionMap(MINI);
    expect(map.start).toBe("start");
    expect(Object.keys(map.nodes)).toHaveLength(8);
    expect(map.nodes["learn-data"]).toEqual({
      id: "learn-data", kind: "narrow", question: "어떤 쪽이 더 끌려요?",
      a: { label: "DB에서 꺼내기", effects: { keywords: ["SQL"] }, next: "mood-way" },
      b: { label: "표로 정리하기", effects: { keywords: ["엑셀"] }, next: "mood-way" },
      unsureNext: "mood-way",
    });
    expect(map.nodes["mood-temp"].a.effects).toEqual({ axes: { temp: 1 } });
    expect(map.nodes["mood-len"].b.effects).toEqual({ len: -1 });
    expect(map.nodes.start.b.effects).toEqual({ mode: "challenge" });
    expect(map.far).toEqual([{ from: { entry: "target", topics: ["데이터 분석"] }, to: { entry: "leaf", genres: ["에세이"] } }]);
  });

  it("refuses a node with a missing line, an unknown effect, or a repeated id — naming the node", () => {
    const missing = "```node\nid: x\nkind: mood\nquestion: q\nA: a | next=draw\nunsure: next=draw\n```";
    expect(() => parseQuestionMap(missing)).toThrow(MapParseError);
    expect(() => parseQuestionMap(missing)).toThrow(/x.*B:/);
    const unknown = "```node\nid: y\nkind: mood\nquestion: q\nA: a | color=red | next=draw\nB: b | next=draw\nunsure: next=draw\n```";
    expect(() => parseQuestionMap(unknown)).toThrow(/y.*color/);
    const twice = `${MINI}\n\`\`\`node\nid: start\nkind: mood\nquestion: q\nA: a | next=draw\nB: b | next=draw\nunsure: next=draw\n\`\`\``;
    expect(() => parseQuestionMap(twice)).toThrow(/start.*twice/);
    expect(() => parseQuestionMap("# nothing here")).toThrow(/no node/);
  });

  it("refuses a bad axis value or a choice without next", () => {
    const badAxis = "```node\nid: z\nkind: mood\nquestion: q\nA: a | temp=2 | next=draw\nB: b | next=draw\nunsure: next=draw\n```";
    expect(() => parseQuestionMap(badAxis)).toThrow(/z.*temp/);
    const noNext = "```node\nid: w\nkind: mood\nquestion: q\nA: a | len=+1\nB: b | next=draw\nunsure: next=draw\n```";
    expect(() => parseQuestionMap(noNext)).toThrow(/w.*next/);
  });

  const node = (lines: string) => `\`\`\`node\nid: n\nkind: mood\nquestion: q\n${lines}\n\`\`\``;
  const AB = "A: a | next=draw\nB: b | next=draw";

  it("refuses a part that is not key=value, a choice without a label, a bad kind, an unsure without next", () => {
    expect(() => parseQuestionMap(node(`A: a | oops | next=draw\nB: b | next=draw\nunsure: next=draw`))).toThrow(/n.*"oops" is not key=value/);
    expect(() => parseQuestionMap(node(`A: | next=draw\nB: b | next=draw\nunsure: next=draw`))).toThrow(/n.*no label/);
    expect(() => parseQuestionMap(node(`${AB}\nunsure: next=draw`).replace("kind: mood", "kind: other"))).toThrow(/n.*kind/);
    expect(() => parseQuestionMap(node(`${AB}\nunsure: next=`))).toThrow(/n.*unsure has no next/);
  });

  it("refuses a line given twice in a block", () => {
    expect(() => parseQuestionMap(node(`${AB}\nB: c | next=draw\nunsure: next=draw`))).toThrow(/n.*"B:" line appears twice/);
    const far = `${MINI}\n\`\`\`far\nfrom: entry=leaf\nfrom: entry=target\nto: entry=leaf\n\`\`\``;
    expect(() => parseQuestionMap(far)).toThrow(/far.*"from:" line appears twice/);
  });

  it("refuses an unsure line that sets anything besides next", () => {
    expect(() => parseQuestionMap(node(`${AB}\nunsure: len=+1 | next=draw`))).toThrow(/n.*unsure may only have next=/);
  });

  it("refuses an empty list", () => {
    expect(() => parseQuestionMap(node(`A: a | genres= | next=draw\nB: b | next=draw\nunsure: next=draw`))).toThrow(/n.*genres is empty/);
    expect(() => parseQuestionMap(node(`A: a | keywords= , | next=draw\nB: b | next=draw\nunsure: next=draw`))).toThrow(/n.*keywords is empty/);
  });

  it("reads far scopes by keywords or genres alone, and refuses a far side with no scope", () => {
    const far = (from: string, to: string) => parseQuestionMap(`${MINI}\n\`\`\`far\nfrom: ${from}\nto: ${to}\n\`\`\``).far[1];
    expect(far("keywords=SQL", "genres=시")).toEqual({ from: { keywords: ["SQL"] }, to: { genres: ["시"] } });
    expect(() => far("len=+1", "entry=leaf")).toThrow(/far: from sets no scope/);
    expect(() => far("entry=leaf", "way=개념")).toThrow(/far: to sets no scope/);
  });
});
