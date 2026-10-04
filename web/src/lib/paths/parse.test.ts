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
});
