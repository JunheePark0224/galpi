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
    expect(map.nodes["mood-way"].a.effects).toEqual({ ways: ["개념"] });
    expect(map.far).toEqual([{ from: { entry: "target", topics: ["데이터 분석"] }, to: { entry: "leaf", genres: ["인문"] }, n: 1, title: "데이터 분석 → 인문", why: "숫자에서 사람으로" }]);
  });

  it("reads a way list (any of them gets the way points) and refuses a way we do not have", () => {
    const node = (way: string) => `\`\`\`node\nid: w\nkind: mood\nquestion: q\nA: a | way=${way} | next=draw\nB: b | next=draw\nunsure: next=draw\n\`\`\``;
    expect(parseQuestionMap(node("실습,사례")).nodes.w.a.effects).toEqual({ ways: ["실습", "사례"] });
    expect(() => parseQuestionMap(node("실습,요약"))).toThrow(/w.*way=실습,요약/);
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

  it("v2 (10-05): reads a far rule's heading as its number and title, `pick: one` lists and the draft `why:` line", () => {
    const block = (body: string, heading = "2. 배우기 · 주제 없음 → 목록") => `${MINI}\n${heading}\n\n\`\`\`far\nfrom: entry=target\n${body}\n\`\`\``;
    const rule = parseQuestionMap(block("to: entry=leaf | genres=인문,과학 교양\npick: one\nwhy: 한 발짝")).far[1];
    expect(rule).toEqual({
      from: { entry: "target" }, to: { entry: "leaf", genres: ["인문", "과학 교양"] }, n: 2, title: "배우기 · 주제 없음 → 목록", pick: "one", why: "한 발짝",
    });
    expect(parseQuestionMap(block("to: entry=leaf | genres=인문", "그냥 문단")).far[1]).toEqual({ from: { entry: "target" }, to: { entry: "leaf", genres: ["인문"] } });
    // 10-05: a number stays with its rule — a newer rule may sit above older ones (its place is its priority), never reuse one
    expect(parseQuestionMap(block("to: entry=leaf | genres=인문", "37. 새 규칙")).far[1]).toMatchObject({ n: 37, title: "새 규칙" });
    expect(() => parseQuestionMap(block("to: entry=leaf | genres=인문", "1. 번호가 겹침"))).toThrow(/far 1: the number 1 is used twice/);
    const second = "\n2. 자리 번호와 겹침\n\n```far\nfrom: entry=leaf\nto: entry=leaf | genres=시\n```";
    expect(() => parseQuestionMap(`${block("to: entry=leaf | genres=인문", "그냥 문단")}${second}`))
      .toThrow(/far 2: the number 2 is used twice/);
    expect(() => parseQuestionMap(block("to: entry=leaf | genres=인문\npick: all"))).toThrow(/far 2: pick must be "one", got "all"/);
    expect(() => parseQuestionMap(block("to: entry=leaf\npick: one"))).toThrow(/far 2: pick: one needs a genres list/);
    expect(() => parseQuestionMap(block("to: entry=leaf | genres=인문\nwhy:"))).toThrow(/far 2: why is empty/);
    expect(() => parseQuestionMap(block("to: entry=leaf | genres=인문\nreason: 오타"))).toThrow(/far 2: unknown line "reason:"/);
  });
});
