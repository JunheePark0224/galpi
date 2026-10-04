import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseQuestionMap } from "./parse";
import { ALL_SCOPE, type Answer } from "./types";
import { applyChallenge, PathError, walkPath } from "./walk";

const MINI = readFileSync(path.join(process.cwd(), "src/lib/paths/__fixtures__/mini-map.md"), "utf8");
const MAP = parseQuestionMap(MINI);
const FAR_SF = "```far\nfrom: entry=target\nto: entry=leaf | genres=SF·판타지\n```\n";
const a = (node: string, choice: Answer["choice"]): Answer => ({ node, choice });
const SQL = [a("start", "A"), a("branch", "B"), a("learn-area", "A"), a("learn-data", "A"), a("mood-way", "B"), a("mood-len", "A")];

describe("walkPath", () => {
  it("starts at the start with the whole scope", () => {
    expect(walkPath(MAP, [])).toMatchObject({ next: "start", scope: ALL_SCOPE, parentScope: ALL_SCOPE, mode: "normal", crumbs: [], depth: 0, unsure: 0 });
  });

  it("follows the SQL path: narrows to the keyword, the parent is the topic, the mood is set, the path ends", () => {
    const w = walkPath(MAP, SQL);
    expect(w.next).toBeNull();
    expect(w.scope).toEqual({ entry: "target", topics: ["데이터 분석"], keywords: ["SQL"], genres: null });
    expect(w.parentScope).toEqual({ entry: "target", topics: ["데이터 분석"], keywords: null, genres: null });
    expect(w.mood).toEqual({ axes: { temp: 0, pull: 0, gain: 0, world: 0 }, len: 1, way: "실습" });
    expect(w.crumbs).toEqual(["뭔가 배우기", "데이터를 다루기", "DB에서 꺼내기"]);
    expect(w.depth).toBe(6);
  });

  it("stops narrowing on 'unsure' and counts it; going back is just one answer fewer", () => {
    const w = walkPath(MAP, [a("start", "A"), a("branch", "B"), a("learn-area", "unsure")]);
    expect(w.next).toBe("mood-way");
    expect(w.scope).toEqual({ ...ALL_SCOPE, entry: "target" });
    expect(w.parentScope).toEqual(ALL_SCOPE);
    expect(w.unsure).toBe(1);
    expect(w.crumbs).toEqual(["뭔가 배우기"]);
    expect(walkPath(MAP, SQL.slice(0, 3)).next).toBe("learn-data");
  });

  it("refuses an answer for a question that was not asked", () => {
    expect(() => walkPath(MAP, [a("branch", "A")])).toThrow(PathError);
    expect(() => walkPath(MAP, [...SQL, a("mood-len", "A")])).toThrow(/after the end/);
  });

  it("challenge: swaps the scope for the far scope and keeps the mood", () => {
    const w = walkPath(MAP, [a("start", "B"), ...SQL.slice(1)]);
    expect(w.mode).toBe("challenge");
    const far = applyChallenge(MAP, w);
    expect(far.scope).toEqual({ entry: "leaf", topics: null, keywords: null, genres: ["에세이"] });
    expect(far.parentScope).toEqual({ entry: "leaf", topics: null, keywords: null, genres: null });
    expect(far.mood).toEqual(w.mood);
  });

  it("challenge with no far rule for the scope: the other side whole (story ↔ learn)", () => {
    const w = walkPath(MAP, [a("start", "B"), a("branch", "A"), a("story-world", "B"), a("mood-temp", "A"), a("mood-len", "A")]);
    expect(applyChallenge(MAP, w).scope).toEqual({ ...ALL_SCOPE, entry: "target" });
  });

  it("challenge with the whole library (no entry chosen): nothing to flip, the scope stays", () => {
    const w = walkPath(MAP, [a("start", "B"), a("branch", "unsure"), a("mood-len", "A")]);
    expect(w.mode).toBe("challenge");
    expect(applyChallenge(MAP, w)).toBe(w);
  });

  it("challenge: the first far rule that matches wins", () => {
    const route = [a("start", "B"), ...SQL.slice(1)];
    const after = parseQuestionMap(`${MINI}\n${FAR_SF}`);
    expect(applyChallenge(after, walkPath(after, route)).scope.genres).toEqual(["에세이"]);
    const before = parseQuestionMap(MINI.replace("```far", `${FAR_SF}\n\`\`\`far`));
    expect(applyChallenge(before, walkPath(before, route)).scope.genres).toEqual(["SF·판타지"]);
  });

  it("challenge: a rule naming another entry does not match", () => {
    const other = parseQuestionMap(MINI.replace("from: entry=target", "from: entry=leaf"));
    const w = walkPath(other, [a("start", "B"), ...SQL.slice(1)]);
    expect(applyChallenge(other, w).scope).toEqual({ ...ALL_SCOPE, entry: "leaf" });
  });

  it("unsure at the first question keeps the usual mode", () => {
    const w = walkPath(MAP, [a("start", "unsure"), a("branch", "A")]);
    expect(w.mode).toBe("normal");
    expect(w.crumbs).toEqual(["이야기에 빠지기"]);
  });

  it("leaves a normal path alone", () => {
    const w = walkPath(MAP, SQL);
    expect(applyChallenge(MAP, w)).toBe(w);
  });
});
