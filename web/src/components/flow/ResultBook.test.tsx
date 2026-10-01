import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyDetail, type BookDetail } from "@/lib/books/detail";
import { loadDetail } from "@/lib/books/detailClient";
import type { PickView } from "@/lib/flow/state";
import { track } from "@/lib/track/client";
import { INTRO_HEADING, LAST_BOOK, NEXT_BOOK, NO_INTRO, ResultBook } from "./ResultBook";

vi.mock("@/lib/track/client", () => ({ track: vi.fn() }));
vi.mock("@/lib/books/detailClient", () => ({ loadDetail: vi.fn() }));

const ISBN = "9790000000001";
const LONG = `${"가".repeat(80)}. ${"나".repeat(60)}. 셋째 문장.`;       // folds after the second sentence (120+ chars)
const DETAIL: BookDetail = {
  source: "yes24", cover: "https://image.yes24.com/goods/1/L", price: 14400, rating: 9.4, pages: 280,
  intro: LONG, link: "https://www.yes24.com/product/goods/1",
};
const pick: PickView = {
  card: { id: ISBN, entry: "leaf", title: "여름의 우편함", author: "한여름", genre: "한국 소설", field: null, oneLiner: "?", oneLinerStyle: "question" },
  kind: "random",
  art: { animal: "cat", bg: "peach", sky: "moon", ground: "none", rare: false },
  reason: { label: "나온 이유", items: ["따뜻함", "현실"] },
};
const show = (detail: BookDetail, position = 1, total = 2, onNext = vi.fn()) => {
  vi.mocked(loadDetail).mockResolvedValue(detail);
  render(<ResultBook pick={pick} position={position} total={total} onNext={onNext} />);
  return onNext;
};

describe("ResultBook (S-06, C-11)", () => {
  afterEach(() => vi.clearAllMocks());

  it("shows the big cover, title, rating · price · pages, the reason and a folded YES24 intro", async () => {
    show(DETAIL);
    expect(await screen.findByRole("img", { name: "여름의 우편함 표지" })).toHaveAttribute("src", DETAIL.cover);
    expect(screen.getByRole("heading", { level: 1, name: "여름의 우편함" })).toBeInTheDocument();
    expect(screen.getByText("궁금해요 1 / 2")).toBeInTheDocument();
    expect(screen.getByText("★ 9.4 · 14,400원 · 280쪽")).toBeInTheDocument();
    expect(screen.getByText("나온 이유").parentElement).toHaveTextContent("나온 이유 따뜻함 · 현실");
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

  it("says 다 봤어요 on the last book", async () => {
    show(DETAIL, 2, 2);
    expect(await screen.findByRole("button", { name: LAST_BOOK })).toBeInTheDocument();
  });

  it("keeps working when YES24 and Kakao are both down: our own cover, the reason, a note, a YES24 search link", async () => {
    show(emptyDetail(ISBN));
    expect(await screen.findByText(NO_INTRO)).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByText(/정보 제공/)).toBeNull();
    expect(screen.queryByText(/★|원|쪽/)).toBeNull();
    expect(screen.getByRole("link", { name: "예스24에서 보기 ↗" })).toHaveAttribute("href", emptyDetail(ISBN).link);
    expect(screen.getByText("나온 이유")).toBeInTheDocument();
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
