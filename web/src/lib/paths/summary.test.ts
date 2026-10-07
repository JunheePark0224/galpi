import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHALLENGE_PATH, MIXED_PATH, SQL_PATH } from "./__fixtures__/paths";
import { QUESTION_MAP } from "./map";
import { parseQuestionMap } from "./parse";
import { pathSummary } from "./summary";
import type { Answer } from "./types";
import { PathError, walkPath } from "./walk";

const MINI = parseQuestionMap(readFileSync(path.join(process.cwd(), "src/lib/paths/__fixtures__/mini-map.md"), "utf8"));
const a = (node: string, choice: Answer["choice"]): Answer => ({ node, choice });
const SQL = [a("start", "A"), a("branch", "B"), a("learn-area", "A"), a("learn-data", "A"), a("mood-way", "B"), a("mood-len", "A")];

describe("pathSummary (S-04 당신이 고른 길)", () => {
  it("lists the narrowing labels, then the mood labels, in the order they were answered", () => {
    expect(pathSummary(MINI, SQL)).toEqual({
      crumbs: ["뭔가 배우기", "데이터를 다루기", "DB에서 꺼내기"], moods: ["바로 따라 하기", "가볍게 한 권"], mode: "normal",
    });
  });

  it("keeps the challenge route and leaves out moods answered with 갈피를 못 잡겠어요", () => {
    const story = [a("start", "B"), a("branch", "A"), a("story-world", "B"), a("mood-temp", "A"), a("mood-len", "unsure")];
    expect(pathSummary(MINI, story)).toEqual({ crumbs: ["이야기에 빠지기", "딴 세상"], moods: ["따뜻한 이야기"], mode: "challenge" });
  });

  it("has no crumbs when nothing was narrowed", () => {
    expect(pathSummary(MINI, [a("start", "A"), a("branch", "unsure"), a("mood-len", "B")])).toEqual({ crumbs: [], moods: ["깊게 파고들기"], mode: "normal" });
  });

  it("works on a path that is not finished yet", () => {
    expect(pathSummary(MINI, SQL.slice(0, 2))).toEqual({ crumbs: ["뭔가 배우기"], moods: [], mode: "normal" });
  });

  it("refuses answers that are not on the map", () => {
    expect(() => pathSummary(MINI, [a("branch", "A")])).toThrow(PathError);
  });

  it("on the real map: a broad answer made finer by the next one (실제로 써먹는 쪽 → 바로 따라 해 보기) shows the finer one", () => {
    const real = [a("start", "A"), a("branch", "B"), a("learn-intro", "B"), a("learn-way", "B"), a("learn-way-use", "A"), a("learn-len", "unsure")];
    expect(pathSummary(QUESTION_MAP, real)).toEqual({ crumbs: ["지금 필요한 걸 채우기"], moods: ["바로 따라 해 보기"], mode: "normal" });
  });

  it("on the real map: left broad (못 잡겠어요 next, or the next question passed over), the broad answer shows", () => {
    const real = [a("start", "A"), a("branch", "B"), a("learn-intro", "B"), a("learn-way", "B"), a("learn-way-use", "unsure"), a("learn-len", "B")];
    expect(pathSummary(QUESTION_MAP, real)).toEqual({ crumbs: ["지금 필요한 걸 채우기"], moods: ["실제로 써먹는 쪽", "두툼한 책 한 권"], mode: "normal" });
    expect(walkPath(QUESTION_MAP, SQL_PATH).skipped).toEqual(["learn-way-use"]);
    expect(pathSummary(QUESTION_MAP, SQL_PATH).moods).toEqual(["실제로 써먹는 쪽", "가볍게 읽히는 얇은 책"]);
  });

  it("on the real map: two mood answers in a row on different axes both show", () => {
    const real = [a("start", "A"), a("branch", "A"), a("story-intro", "B"), a("story-gain", "A"), a("story-world", "B"), a("story-temp", "unsure"), a("story-pull", "unsure"), a("story-len", "unsure")];
    expect(pathSummary(QUESTION_MAP, real).moods).toEqual(["뭔가 하나 알게 된 나", "여기 없는 딴 세상"]);
  });

  it("never lists a question the walk passed over", () => {
    const skipLen = { ...MINI, skip: new Set(["mood-len|normal|all"]) };
    expect(pathSummary(skipLen, [a("start", "A"), a("branch", "unsure")])).toEqual({ crumbs: [], moods: [], mode: "normal" });
  });

  it("on the real map: the three test paths end, with the summaries S-04 shows", () => {
    for (const p of [SQL_PATH, MIXED_PATH, CHALLENGE_PATH]) expect(walkPath(QUESTION_MAP, p).next).toBeNull();
    expect(pathSummary(QUESTION_MAP, SQL_PATH)).toEqual({
      crumbs: ["지금 필요한 걸 채우기", "일을 더 잘하기", "숫자·도구 다루기", "데이터 읽고 분석", "데이터 꺼내는 도구", "DB에서 꺼내기"],
      moods: ["실제로 써먹는 쪽", "가볍게 읽히는 얇은 책"], mode: "normal",
    });
    expect(pathSummary(QUESTION_MAP, MIXED_PATH)).toEqual({ crumbs: [], moods: ["가볍게 얇은 책"], mode: "normal" });
    expect(pathSummary(QUESTION_MAP, CHALLENGE_PATH)).toEqual({
      crumbs: ["읽는 시간 자체를 즐기기", "소설 속으로", "장르의 짜릿함", "여기 없는 딴 세상"],
      moods: ["몽글몽글 따뜻함", "쏙 들어가는 얇은 책"], mode: "challenge",
    });
  });
});
