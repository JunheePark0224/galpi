import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { emptyDetail, type BookDetail } from "@/lib/books/detail";
import { loadDetail } from "@/lib/books/detailClient";
import { loadAccount, setKeepState } from "@/lib/account/store";
import { metDate } from "@/lib/flow/bookmarkPull";
import { RESULT_GUIDE_KEY, resultGuide } from "@/lib/flow/firstGuide";
import type { PickView } from "@/lib/flow/state";
import { track } from "@/lib/track/client";
import { FLIP_BACK, FLIP_FRONT, PULL_CUE, PULL_OUT, SAID_FRONT } from "./BookmarkInBook";
import { RESULT_GUIDE_KEEP, RESULT_GUIDE_PULL, RESULT_GUIDE_TURN } from "./FirstGuide";
import { INTRO_HEADING, LAST_BOOK, NEXT_BOOK, NO_INTRO, ResultBook } from "./ResultBook";

vi.mock("@/lib/track/client", () => ({ track: vi.fn() }));
vi.mock("@/lib/books/detailClient", () => ({ loadDetail: vi.fn(), peekDetail: () => undefined }));
const pressKeep = vi.fn();
vi.mock("@/lib/library/keep", () => ({ pressKeep: (...a: unknown[]) => pressKeep(...a), pressUnkeep: vi.fn() }));

const ISBN = "9790000000001";
const LONG = `${"가".repeat(80)}. ${"나".repeat(60)}. 셋째 문장.`;       // folds after the second sentence (120+ chars)
const DETAIL: BookDetail = {
  source: "yes24", cover: "https://image.yes24.com/goods/1/L", price: 14400, rating: 9.4, pages: 280,
  intro: LONG, link: "https://www.yes24.com/product/goods/1",
};
const pick: PickView = {
  card: { id: ISBN, entry: "leaf", title: "여름의 우편함", author: "한여름", genre: "한국 소설", field: null, oneLiner: "?", oneLinerStyle: "question" },
  kind: "random",
  art: { animal: "cat", bg: "peach", ground: "none", rare: false },
  reason: { label: "나온 이유", items: ["따뜻함", "현실"] },
};
const show = (detail: BookDetail, position = 1, total = 2, onNext = vi.fn()) => {
  vi.mocked(loadDetail).mockResolvedValue(detail);
  render(<ResultBook pick={pick} position={position} total={total} onNext={onNext} />);
  return onNext;
};

describe("ResultBook (S-06, C-11)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    resultGuide.forgetForTests();
  });

  it("shows the big cover, title, rating · price · pages and a folded YES24 intro — no 나온 이유 line (10-01)", async () => {
    show(DETAIL);
    expect(await screen.findByRole("img", { name: "여름의 우편함 표지" })).toHaveAttribute("src", DETAIL.cover);
    expect(screen.getByRole("heading", { level: 1, name: "여름의 우편함" })).toBeInTheDocument();
    expect(screen.getByText("궁금해요 1 / 2")).toBeInTheDocument();
    expect(screen.getByText("★ 9.4 · 14,400원 · 280쪽")).toBeInTheDocument();
    expect(screen.queryByText(/나온 이유|이 책은/)).toBeNull();               // kept for the bookmark back (P5), not shown here
    expect(screen.getByRole("heading", { level: 2, name: INTRO_HEADING })).toBeInTheDocument();
    expect(screen.getByText(`${"가".repeat(80)}. ${"나".repeat(60)}.`)).toBeInTheDocument();
    expect(screen.getByText("정보 제공: 예스24")).toBeInTheDocument();
    expect(loadDetail).toHaveBeenCalledWith(ISBN);
  });

  it("unfolds the whole intro on [더 보기] and logs E-23 with the pick type", async () => {
    show(DETAIL);
    fireEvent.click(await screen.findByRole("button", { name: "더 보기" }));
    expect(screen.getByText(LONG)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "더 보기" })).toBeNull();
    expect(track).toHaveBeenCalledWith("description_expanded", { book_id: ISBN, pick_type: "random" });
  });

  it("has no [더 보기] when the intro is short", async () => {
    show({ ...DETAIL, intro: "짧은 소개." });
    expect(await screen.findByText("짧은 소개.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "더 보기" })).toBeNull();
  });

  it("opens YES24 in a new tab and logs E-18 (source result)", async () => {
    show(DETAIL);
    const link = await screen.findByRole("link", { name: "예스24에서 보기 ↗" });
    expect(link).toHaveAttribute("href", DETAIL.link);
    expect(link).toHaveAttribute("target", "_blank");
    fireEvent.click(link);
    expect(track).toHaveBeenCalledWith("yes24_link_clicked", { book_id: ISBN, source: "result", pick_type: "random" });
  });

  it("goes on with [다음 책], and says [다 봤어요] on the last book", async () => {
    const onNext = show(DETAIL, 1, 2);
    fireEvent.click(await screen.findByRole("button", { name: NEXT_BOOK }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("turns back and on with ‹ › (10-02): ‹ is off on the first book, › on the last — [다 봤어요] ends", async () => {
    vi.mocked(loadDetail).mockResolvedValue(DETAIL);
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const { rerender } = render(<ResultBook pick={pick} position={1} total={3} onNext={onNext} onPrev={onPrev} />);
    expect(await screen.findByRole("button", { name: "앞 책 보기" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "뒤 책 보기" }));
    expect(onNext).toHaveBeenCalledTimes(1);
    rerender(<ResultBook pick={pick} position={3} total={3} onNext={onNext} onPrev={onPrev} />);
    expect(screen.getByRole("button", { name: "뒤 책 보기" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "앞 책 보기" }));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("has no ‹ › with a single 궁금해요 book", async () => {
    vi.mocked(loadDetail).mockResolvedValue(DETAIL);
    render(<ResultBook pick={pick} position={1} total={1} onNext={vi.fn()} onPrev={vi.fn()} />);
    await screen.findByRole("button", { name: LAST_BOOK });
    expect(screen.queryByRole("button", { name: "앞 책 보기" })).toBeNull();
  });

  it("says 다 봤어요 on the last book", async () => {
    show(DETAIL, 2, 2);
    expect(await screen.findByRole("button", { name: LAST_BOOK })).toBeInTheDocument();
  });

  it("keeps working when YES24 and Kakao are both down: our own cover, a note, a YES24 search link", async () => {
    show(emptyDetail(ISBN));
    expect(await screen.findByText(NO_INTRO)).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByText(/정보 제공/)).toBeNull();
    expect(screen.queryByText(/★|원|쪽/)).toBeNull();
    expect(screen.getByRole("link", { name: "예스24에서 보기 ↗" })).toHaveAttribute("href", emptyDetail(ISBN).link);
    expect(screen.queryByText("나온 이유")).toBeNull();
  });

  it("swaps the cover for our cloth cover when the image fails to load, and tries again for the next book", async () => {
    vi.mocked(loadDetail).mockResolvedValue(DETAIL);
    const { rerender } = render(<ResultBook pick={pick} position={1} total={2} onNext={vi.fn()} />);
    const img = await screen.findByRole("img", { name: "여름의 우편함 표지" });
    expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(img).toHaveAttribute("decoding", "async");
    fireEvent.error(img);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getAllByText("여름의 우편함").length).toBeGreaterThan(1);       // the cloth cover carries the title next to the heading

    const next: PickView = { ...pick, card: { ...pick.card, id: "9790000000002", title: "겨울의 우체국" } };
    vi.mocked(loadDetail).mockResolvedValue({ ...DETAIL, cover: "https://image.yes24.com/goods/2/L" });
    rerender(<ResultBook pick={next} position={2} total={2} onNext={vi.fn()} />);
    expect(await screen.findByRole("img", { name: "겨울의 우체국 표지" })).toBeInTheDocument();
  });

  it("credits Kakao when only Kakao answered", async () => {
    show({ ...emptyDetail(ISBN), source: "kakao", price: 14400, cover: "https://search1.kakaocdn.net/thumb/x" });
    expect(await screen.findByText("정보 제공: 카카오")).toBeInTheDocument();
    expect(screen.getByText("14,400원")).toBeInTheDocument();
  });

  it("links to the YES24 search while the detail is still loading", () => {
    vi.mocked(loadDetail).mockReturnValue(new Promise(() => {}));
    render(<ResultBook pick={pick} position={1} total={1} onNext={vi.fn()} />);
    expect(screen.getByRole("link", { name: "예스24에서 보기 ↗" })).toHaveAttribute("href", emptyDetail(ISBN).link);
    expect(screen.queryByText(NO_INTRO)).toBeNull();
  });
});

describe("ResultBook — the bookmark in the book (C-16)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    window.localStorage.clear();
    resultGuide.forgetForTests();
  });

  const stage = () => document.querySelector("[data-pose]") as HTMLElement;
  const pullButton = () => screen.getByRole("button", { name: PULL_OUT });

  it("peeks the very bookmark of S-05 (pick.art) out of the cover, as a closed disclosure button", async () => {
    show(DETAIL);
    await screen.findByRole("img", { name: "여름의 우편함 표지" });
    expect(stage()).toHaveAttribute("data-pose", "in");
    expect(stage().querySelector("image")).toHaveAttribute("href", "/animals/cat.svg");
    expect(pullButton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: FLIP_BACK })).toBeNull();
    expect(screen.queryByText("만난 날")).toBeNull();                              // the back is not there while it is in
  });

  it("pulls it out on a tap (E-27 with book, position, pick type), then puts it back on a second tap", async () => {
    show(DETAIL, 2, 3);
    fireEvent.click(pullButton());
    const out = screen.getByRole("button", { name: PULL_OUT });                      // one name; aria-expanded tells in from out
    expect(out).toHaveAttribute("aria-expanded", "true");
    expect(stage()).toHaveAttribute("data-pose", "out");
    expect(track).toHaveBeenCalledWith("bookmark_pulled", { book_id: ISBN, position: 2, pick_type: "random" });
    expect(screen.getByRole("button", { name: FLIP_BACK })).toBeInTheDocument();

    fireEvent.click(out);
    expect(pullButton()).toHaveAttribute("aria-expanded", "false");
    expect(stage()).toHaveAttribute("data-pose", "in");
    expect(screen.queryByRole("button", { name: FLIP_BACK })).toBeNull();
    expect(vi.mocked(track).mock.calls.filter(([name]) => name === "bookmark_pulled")).toHaveLength(1);
  });

  it("goes opaque over the cover (T-03 exception) and back to the frost film once it is in again", () => {
    show(DETAIL);
    const film = () => stage().querySelector("article")!;
    expect(film()).not.toHaveAttribute("data-moving");
    fireEvent.click(pullButton());
    expect(film()).toHaveAttribute("data-moving");
    fireEvent.click(pullButton());
    fireEvent.animationEnd(stage().querySelector("[data-pull]")!);
    expect(film()).not.toHaveAttribute("data-moving");
  });

  it("flips to the back: title, 나온 이유 and its items, 만난 날 today (E-28 once per turn to the back)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 1, 21, 0));
    show(DETAIL);
    fireEvent.click(pullButton());
    fireEvent.click(screen.getByRole("button", { name: FLIP_BACK }));

    const back = screen.getByRole("article", { name: "여름의 우편함 책갈피 뒷면" });
    expect(within(back).getByText("나온 이유")).toBeInTheDocument();
    expect(within(back).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["따뜻함", "현실"]);
    expect(within(back).getByText("만난 날")).toBeInTheDocument();
    expect(within(back).getByText(metDate(new Date(2026, 9, 1)))).toBeInTheDocument();
    expect(stage()).toHaveAttribute("data-flipped");
    expect(track).toHaveBeenCalledWith("bookmark_flipped", { book_id: ISBN, pick_type: "random" });

    expect(screen.getByRole("status")).toHaveTextContent(`책갈피 뒷면. 나온 이유: 따뜻함, 현실. 만난 날 ${metDate(new Date(2026, 9, 1))}`);

    fireEvent.click(screen.getByRole("button", { name: FLIP_FRONT }));
    expect(stage()).not.toHaveAttribute("data-flipped");
    expect(screen.getByRole("status")).toHaveTextContent(SAID_FRONT);
    expect(vi.mocked(track).mock.calls.filter(([name]) => name === "bookmark_flipped")).toHaveLength(1);
  });

  it("leaves the reason block off the back when the reason has no items", () => {
    vi.mocked(loadDetail).mockResolvedValue(DETAIL);
    render(<ResultBook pick={{ ...pick, reason: { label: "이 책은", items: [] } }} position={1} total={1} onNext={vi.fn()} />);
    fireEvent.click(pullButton());
    fireEvent.click(screen.getByRole("button", { name: FLIP_BACK }));
    const back = screen.getByRole("article", { name: "여름의 우편함 책갈피 뒷면" });
    expect(within(back).queryByText("이 책은")).toBeNull();
    expect(within(back).queryByRole("list")).toBeNull();
    expect(within(back).getByText("만난 날")).toBeInTheDocument();
    expect(screen.getByRole("status")).not.toHaveTextContent("이 책은");
  });

  it("puts a flipped bookmark back front side first", () => {
    show(DETAIL);
    fireEvent.click(pullButton());
    fireEvent.click(screen.getByRole("button", { name: FLIP_BACK }));
    fireEvent.click(pullButton());
    expect(stage()).not.toHaveAttribute("data-flipped");
  });

  const mouse = { pointerId: 1, pointerType: "mouse", buttons: 1 } as const;

  it("pulls it out when dragged up with a mouse, without the click that follows putting it straight back", () => {
    vi.useFakeTimers();
    show(DETAIL);
    const button = pullButton();
    fireEvent.pointerDown(button, { ...mouse, clientY: 300 });
    fireEvent.pointerMove(button, { ...mouse, clientY: 290 });
    expect(stage()).toHaveAttribute("data-pose", "in");                           // 10px is not a drag yet
    fireEvent.pointerMove(button, { ...mouse, clientY: 260 });
    expect(stage()).toHaveAttribute("data-pose", "out");
    fireEvent.pointerUp(button, { ...mouse, buttons: 0, clientY: 260 });
    fireEvent.click(button, { detail: 1 });                                         // the browser's trailing click
    expect(stage()).toHaveAttribute("data-pose", "out");
    vi.runAllTimers();
    fireEvent.click(button, { detail: 1 });                                         // the next real click still works
    expect(stage()).toHaveAttribute("data-pose", "in");
    expect(vi.mocked(track).mock.calls.filter(([name]) => name === "bookmark_pulled")).toHaveLength(1);
  });

  it("never starts a drag from a finger: touch scrolls the page, only a tap pulls", () => {
    show(DETAIL);
    const button = pullButton();
    const finger = { pointerId: 2, pointerType: "touch", buttons: 1 } as const;
    fireEvent.pointerDown(button, { ...finger, clientY: 300 });
    fireEvent.pointerMove(button, { ...finger, clientY: 200 });
    expect(stage()).toHaveAttribute("data-pose", "in");
    fireEvent.pointerCancel(button, finger);                                         // the browser took the swipe as a scroll
    expect(track).not.toHaveBeenCalledWith("bookmark_pulled", expect.anything());
    fireEvent.click(button, { detail: 1 });
    expect(stage()).toHaveAttribute("data-pose", "out");
  });

  it("ignores pointer moves with no button pressed, even after a press released elsewhere", () => {
    show(DETAIL);
    const button = pullButton();
    fireEvent.pointerDown(button, { ...mouse, clientY: 300 });                     // released outside: no pointerup here
    fireEvent.pointerMove(button, { ...mouse, buttons: 0, clientY: 200 });          // later hover, moving up
    expect(stage()).toHaveAttribute("data-pose", "in");
    expect(track).not.toHaveBeenCalledWith("bookmark_pulled", expect.anything());
  });

  it("never swallows a keyboard or assistive-tech activation after a drag", () => {
    show(DETAIL);
    const button = pullButton();
    fireEvent.pointerDown(button, { ...mouse, clientY: 300 });
    fireEvent.pointerMove(button, { ...mouse, clientY: 250 });                      // dragged out, released off the button
    expect(stage()).toHaveAttribute("data-pose", "out");
    fireEvent.click(button);                                                         // detail 0: Enter, Space or a screen reader
    expect(stage()).toHaveAttribute("data-pose", "in");

    fireEvent.pointerDown(button, { ...mouse, clientY: 300 });
    fireEvent.pointerMove(button, { ...mouse, clientY: 250 });
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.click(button, { detail: 1 });
    expect(stage()).toHaveAttribute("data-pose", "in");
  });

  it("has no C-14 slip any more (retired for the C-21 guide), only a hover cue that is not read out", () => {
    show(DETAIL);
    expect(screen.queryByText("책갈피를 꺼내 보세요")).toBeNull();
    expect(screen.getByText(PULL_CUE)).toHaveAttribute("aria-hidden", "true");     // the button's own name says it
    fireEvent.click(pullButton());
    expect(screen.queryByText(PULL_CUE)).toBeNull();                              // out: nothing to pull
  });

  it("keeps [예스24에서 보기] the one primary button, pulled or not — and no 꽂기 while nobody has answered who is here", async () => {
    show(DETAIL);
    const link = await screen.findByRole("link", { name: "예스24에서 보기 ↗" });
    expect(link).toHaveAttribute("data-variant", "primary");
    fireEvent.click(pullButton());
    expect(link).toHaveAttribute("data-variant", "primary");
    expect(screen.queryByText(/꽂기|로그인하면/)).toBeNull();
    expect(screen.queryByTestId("title-pull")).toBeNull();                        // the old [책갈피 꺼내기] pill is gone (10-02)
  });
});

describe("ResultBook — [🔖 내 책갈피에 저장] and the S-06 guide (C-16b v1.7 · C-21)", () => {
  beforeAll(async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ enabled: true, loggedIn: true, id: "u1", count: 0 }) }));
    await act(async () => { await loadAccount(true); });
  });
  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    resultGuide.forgetForTests();
    act(() => setKeepState(ISBN, null));
  });

  const stage = () => document.querySelector("[data-pose]") as HTMLElement;
  const seen = () => window.localStorage.setItem(RESULT_GUIDE_KEY, "1");
  const guide = () => screen.queryByRole("dialog", { name: "궁금해요 책 보는 법" });
  const pullButton = () => screen.getByRole("button", { name: PULL_OUT });

  it("shows [🔖 내 책갈피에 저장] under the title and author, above YES24, before any pull; one tap saves (no E-27)", async () => {
    seen();
    show(DETAIL);
    const keep = await screen.findByRole("button", { name: "내 책갈피에 저장" });
    expect(keep).toHaveTextContent("🔖 내 책갈피에 저장");
    const author = screen.getAllByText("한여름").at(-1) as HTMLElement;              // the page's author line (the bookmark has one too)
    const yes24 = screen.getByRole("link", { name: "예스24에서 보기 ↗" });
    expect(author.compareDocumentPosition(keep) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();   // under the author
    expect(keep.compareDocumentPosition(yes24) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();    // above YES24
    fireEvent.click(keep);
    expect(pressKeep).toHaveBeenCalledWith(
      { isbn: ISBN, art: pick.art, reason: pick.reason, metOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), card: pick.card }, true);
    expect(stage()).toHaveAttribute("data-pose", "in");
    expect(track).not.toHaveBeenCalledWith("bookmark_pulled", expect.anything());
    expect(screen.getByRole("link", { name: "예스24에서 보기 ↗" })).toHaveAttribute("data-variant", "primary");
  });

  it("has one save button only — none under the book when it is pulled out, no 꽂기 pill — and YES24 stays the main button", async () => {
    seen();
    show(DETAIL);
    await screen.findByRole("button", { name: "내 책갈피에 저장" });
    fireEvent.click(pullButton());
    expect(screen.getAllByRole("button", { name: /내 책갈피에 저장/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /꽂기/ })).toBeNull();
    expect(screen.getByRole("link", { name: "예스24에서 보기 ↗" })).toHaveAttribute("data-variant", "primary");
  });

  it("turns into the green ✓ 내 책갈피에 저장했어요 once saved", async () => {
    seen();
    show(DETAIL);
    await screen.findByRole("button", { name: "내 책갈피에 저장" });
    act(() => setKeepState(ISBN, "saved"));
    expect(screen.getByRole("button", { name: "내 책갈피에 저장했어요" })).toHaveTextContent("✓ 내 책갈피에 저장했어요");
    expect(screen.queryByRole("button", { name: "내 책갈피에 저장" })).toBeNull();
  });

  it("explains the first S-06 book once: ① the peek, ② ‹ ›, ③ 꽂기, focus on [알겠어요]; remembered when closed", async () => {
    vi.mocked(loadDetail).mockResolvedValue(DETAIL);
    const { rerender } = render(<ResultBook pick={pick} position={1} total={2} onNext={vi.fn()} onPrev={vi.fn()} />);
    const dialog = await screen.findByRole("dialog", { name: "궁금해요 책 보는 법" }, { timeout: 5000 });
    expect(within(dialog).getByText(`① ${RESULT_GUIDE_PULL}`)).toBeInTheDocument();
    expect(within(dialog).getByText(`② ${RESULT_GUIDE_TURN}`)).toBeInTheDocument();
    expect(within(dialog).getByText(`③ ${RESULT_GUIDE_KEEP}`)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "알겠어요" })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole("button", { name: "알겠어요" }));
    expect(guide()).toBeNull();
    expect(window.localStorage.getItem(RESULT_GUIDE_KEY)).toBe("1");

    const next: PickView = { ...pick, card: { ...pick.card, id: "9790000000002", title: "겨울의 우체국" } };
    rerender(<ResultBook key="next" pick={next} position={2} total={2} onNext={vi.fn()} onPrev={vi.fn()} />);
    await new Promise((r) => setTimeout(r, 600));
    expect(guide()).toBeNull();
  });

  it("with one book there are no arrows: two steps, ① the peek and ② 꽂기; Escape closes", async () => {
    vi.mocked(loadDetail).mockResolvedValue(DETAIL);
    render(<ResultBook pick={pick} position={1} total={1} onNext={vi.fn()} onPrev={vi.fn()} />);
    const dialog = await screen.findByRole("dialog", { name: "궁금해요 책 보는 법" }, { timeout: 5000 });
    expect(within(dialog).getByText(`② ${RESULT_GUIDE_KEEP}`)).toBeInTheDocument();
    expect(within(dialog).queryByText(new RegExp(RESULT_GUIDE_TURN))).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(guide()).toBeNull();
  });
});
