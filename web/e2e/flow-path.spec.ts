import { expect, type Page } from "@playwright/test";
import built from "../src/data/question-map.json";
import { CHALLENGE_PATH, MIXED_PATH, SQL_PATH } from "../src/lib/paths/__fixtures__/paths";
import type { QuestionMap } from "../src/lib/paths/types";
import { answerPath, holdUnsure, named, reactToBookmarks, recordEvents, specMismatches, START, test } from "./helpers";

test.use({ reducedMotion: "reduce" });

const MAP = built as QuestionMap;
/** PATH_SHOTS=<folder>: save S-01 / S-02 / S-04 screenshots for the design check (phone project). */
const SHOTS = process.env.PATH_SHOTS;
const heading = (page: Page, node: string) => page.getByRole("heading", { level: 1, name: MAP.nodes[node].question, exact: true });
const shot = async (page: Page, name: string) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

test("SQL path: ten questions (써먹는 쪽 is not split: no 사례 SQL book), no path or count while answering, then 당신이 고른 길 and five bookmarks (E-32 · E-25 · E-34)", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await expect(page.getByText("질문 몇 개면 한 권을 만나요")).toBeVisible();
  await shot(page, "s01-home");
  await page.getByRole("button", { name: START }).click();
  await expect(heading(page, "start")).toBeVisible();
  await holdUnsure(page, 300);                                            // let go early: still the first question
  await expect(heading(page, "start")).toBeVisible();
  await shot(page, "s02-first-question");
  await answerPath(page, SQL_PATH.slice(0, 8));
  await expect(heading(page, "learn-len")).toBeVisible();                 // learn-way passed over (4 SQL books, all drawn)
  await expect(page.getByText(/\d+\s*\/\s*\d+/)).toHaveCount(0);           // no "n / 9"
  await expect(page.getByText("일을 더 잘하기")).toHaveCount(0);           // no crumbs while answering
  await shot(page, "s02-question");
  await answerPath(page, SQL_PATH.slice(8));

  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect(page.getByRole("heading", { name: "당신이 고른 길" })).toBeVisible();
  await expect(page.getByRole("region", { name: "지나온 길" })).toContainText("DB에서 꺼내기");
  await expect(page.getByRole("region", { name: "기분" })).toContainText("가볍게 읽히는 얇은 책");
  await expect(page.getByText(/\d+권/)).toHaveCount(0);                    // no book-count note (design 10절)
  await expect(page.getByText("평소의 당신과 반대편에서 골랐어요")).toHaveCount(0);   // a normal path: no challenge line
  await shot(page, "s04-path");
  await page.getByRole("button", { name: "다음 장" }).click();
  await reactToBookmarks(page, ["패스", "패스", "패스", "패스", "패스"], 5);

  await expect.poll(() => named(events, "path_completed").length).toBe(1);
  const answered = named(events, "question_answered");
  expect(answered.map((e) => e.props.node_id)).toEqual(SQL_PATH.map((a) => a.node));   // a question passed over sends nothing
  expect(answered.map((e) => e.props.node_id)).not.toContain("learn-way");
  expect(answered.map((e) => e.props.depth)).toEqual(SQL_PATH.map((_, i) => i + 1));
  expect(answered.map((e) => e.props.position)).toEqual(SQL_PATH.map((_, i) => i + 1));
  expect(answered[0].props).toMatchObject({ kind: "narrow", choice: "A" });
  expect(answered[0].common).toMatchObject({ entry: null, mode: null, screen_version: "v2" });
  expect(named(events, "unsure_hold_cancelled")[0].props).toMatchObject({ node_id: "start", depth: 1 });
  expect(named(events, "path_completed")[0]).toMatchObject({
    props: { scope_id: "entry=target;topics=데이터 분석;keywords=SQL", depth: 9, unsure_count: 0 },
    common: { entry: "target", mode: "normal" },
  });
  expect(named(events, "bookmark_shown")[0].common).toMatchObject({ entry: "target", mode: "normal" });
  expect(named(events, "bookmark_shown")[0].props).toMatchObject({ challenge_rule: null, challenge_genre: null });   // taxonomy v1.5
  expect(specMismatches(events)).toEqual([]);
});

test("갈피를 못 잡겠어요 at the branch: three questions, the whole library on the first page", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: START }).click();
  await answerPath(page, MIXED_PATH);
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect(page.getByRole("region", { name: "지나온 길" })).toContainText("책장 전체에서");
  await expect(page.getByRole("region", { name: "기분" })).toContainText("가볍게 얇은 책");
  await expect.poll(() => named(events, "path_completed").length).toBe(1);
  expect(named(events, "path_completed")[0]).toMatchObject({ props: { scope_id: "all", depth: 3, unsure_count: 1 }, common: { entry: null, mode: "normal" } });
  expect(named(events, "question_answered")[1].props).toMatchObject({ node_id: "branch", choice: "unsure" });
  expect(specMismatches(events)).toEqual([]);
});

test("challenge route: the far side's books, the one-line note on the first page, the same bookmark look", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: START }).click();
  await answerPath(page, CHALLENGE_PATH);
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect(page.getByText("평소의 당신과 반대편에서 골랐어요")).toBeVisible();
  await expect(page.getByRole("region", { name: "지나온 길" })).toContainText("여기 없는 딴 세상");
  await shot(page, "s04-challenge");
  await page.getByRole("button", { name: "다음 장" }).click();
  await expect(page.getByText("1 / 5")).toBeVisible();
  await expect.poll(() => named(events, "bookmark_shown").length).toBe(1);
  expect(named(events, "path_completed")[0]).toMatchObject({
    props: { scope_id: "entry=leaf;genres=시,에세이", depth: 9, unsure_count: 1 }, common: { entry: "leaf", mode: "challenge" },
  });
  // taxonomy v1.5: the rule and the far genre come from the draw response, on the first bookmark of the draw
  const { challenge_rule: rule, challenge_genre: genre } = named(events, "bookmark_shown")[0].props;
  expect(typeof rule).toBe("number");
  expect(typeof genre).toBe("string");
  expect(specMismatches(events)).toEqual([]);
});

test("[← 이전 질문] drops the last answer; on the first question it goes home in a new round (E-33 · E-20)", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: START }).click();
  await answerPath(page, SQL_PATH.slice(0, 2));                              // 평소 → 뭔가 배우기
  await expect(heading(page, "learn-intro")).toBeVisible();
  const back = page.getByRole("button", { name: "이전 질문" });
  expect((await back.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await back.click();
  await expect(heading(page, "branch")).toBeVisible();
  await answerPath(page, [{ node: "branch", choice: "A" }]);                // now 이야기에 빠지기
  await expect(heading(page, "story-intro")).toBeVisible();

  await expect.poll(() => named(events, "question_answered").length).toBe(3);
  expect(named(events, "question_back_clicked").map((e) => e.props)).toEqual([{ node_id: "branch", depth: 2, source: "question" }]);
  expect(named(events, "question_answered").map((e) => [e.props.node_id, e.props.depth, e.props.position])).toEqual([
    ["start", 1, 1], ["branch", 2, 2], ["branch", 2, 3],
  ]);

  await page.getByRole("button", { name: "이전 질문" }).click();            // story-intro → branch
  await page.getByRole("button", { name: "이전 질문" }).click();            // branch → start
  await expect(heading(page, "start")).toBeVisible();
  await page.getByRole("button", { name: "이전 질문" }).click();            // the first question → S-01
  await expect(page.getByRole("button", { name: START })).toBeVisible();
  await expect.poll(() => named(events, "home_clicked").length).toBe(1);
  expect(named(events, "home_clicked")[0]).toMatchObject({ props: { curious_count: 0, source: "question" }, common: { round: 1 } });
  await page.getByRole("button", { name: START }).click();
  await expect.poll(() => named(events, "entry_selected").length).toBe(2);
  expect(named(events, "entry_selected")[1].common).toMatchObject({ round: 2, entry: null, mode: null });
  expect(specMismatches(events)).toEqual([]);
});

test("S-04 [← 질문으로 돌아가기]: the same answer keeps the five books, another answer draws anew", async ({ page }) => {
  const { events } = await recordEvents(page);
  const drawn: string[][] = [];                                             // each /api/books/draw answer's five book ids
  await page.route("**/api/books/draw", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as { picks: { card: { id: string } }[] };
    drawn.push(body.picks.map((p) => p.card.id));
    await route.fulfill({ response: res, json: body });
  });
  /** The five books S-04 now holds (the stored flow state). */
  const shownIds = () => page.evaluate(() =>
    (JSON.parse(sessionStorage.getItem("galpi.flow") ?? "{}").state?.draw?.picks ?? []).map((p: { card: { id: string } }) => p.card.id) as string[]);
  await page.goto("/");
  await page.getByRole("button", { name: START }).click();
  await answerPath(page, SQL_PATH);
  await page.getByRole("button", { name: "책 펼치기" }).click();
  await expect(page.getByRole("button", { name: "다음 장" })).toBeEnabled();
  expect(drawn).toHaveLength(1);
  expect(drawn[0]).toHaveLength(5);
  expect(await shownIds()).toEqual(drawn[0]);

  await page.getByRole("button", { name: "질문으로 돌아가기" }).click();
  await expect(heading(page, "learn-len")).toBeVisible();
  await answerPath(page, [{ node: "learn-len", choice: "A" }]);              // the same answer
  await expect(page.getByRole("heading", { name: "당신이 고른 길" })).toBeVisible();
  await expect(page.getByRole("button", { name: "다음 장" })).toBeEnabled();
  expect(drawn).toHaveLength(1);                                            // no new draw
  expect(await shownIds()).toEqual(drawn[0]);                               // the same five books

  await page.getByRole("button", { name: "질문으로 돌아가기" }).click();
  await answerPath(page, [{ node: "learn-len", choice: "B" }]);              // another answer
  await expect(page.getByRole("region", { name: "기분" })).toContainText("두툼한 책 한 권");
  await expect(page.getByRole("button", { name: "다음 장" })).toBeEnabled();
  expect(drawn).toHaveLength(2);                                            // a new draw
  expect(await shownIds()).toEqual(drawn[1]);
  expect(drawn[1]).not.toEqual(drawn[0]);

  expect(named(events, "question_back_clicked").map((e) => e.props)).toEqual([
    { node_id: "learn-len", depth: 9, source: "first_page" }, { node_id: "learn-len", depth: 9, source: "first_page" },
  ]);
  expect(named(events, "path_completed")).toHaveLength(3);
  expect(named(events, "book_opened")).toHaveLength(1);                     // the book stayed open
  expect(specMismatches(events)).toEqual([]);
});

test("[← 이전 질문] after a question the map passed over: back to the question shown before it", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: START }).click();
  await answerPath(page, SQL_PATH.slice(0, 8));                              // … DB에서 꺼내기
  await expect(heading(page, "learn-len")).toBeVisible();                    // learn-way passed over
  await page.getByRole("button", { name: "이전 질문" }).click();
  await expect(heading(page, "learn-data-tool")).toBeVisible();
  await expect.poll(() => named(events, "question_back_clicked").length).toBe(1);
  expect(named(events, "question_back_clicked")[0].props).toEqual({ node_id: "learn-data-tool", depth: 8, source: "question" });
  expect(named(events, "question_answered").map((e) => e.props.node_id)).not.toContain("learn-way");
  expect(specMismatches(events)).toEqual([]);
});

test("a reload mid-path resumes the same question and keeps counting answers", async ({ page }) => {
  const { events } = await recordEvents(page);
  await page.goto("/");
  await page.getByRole("button", { name: START }).click();
  await answerPath(page, SQL_PATH.slice(0, 3));
  await expect(heading(page, "learn-area")).toBeVisible();
  await page.reload();
  await expect(heading(page, "learn-area")).toBeVisible();
  await answerPath(page, SQL_PATH.slice(3));
  await expect(page.getByText("눌러서 펼치기")).toBeVisible();
  await expect.poll(() => named(events, "path_completed").length).toBe(1);
  expect(named(events, "question_answered").map((e) => e.props.position)).toEqual(SQL_PATH.map((_, i) => i + 1));
  await page.reload();
  await expect(page.getByText("눌러서 펼치기")).toBeVisible();              // S-03 resumes too
  expect(specMismatches(events)).toEqual([]);
});
