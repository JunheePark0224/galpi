import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EXHAUSTED_NOTICE } from "@/lib/recommend";
import { INITIAL, type DrawView, type FlowState } from "@/lib/flow/state";
import { BookScene, DRAW_FAILED } from "./BookScene";

const art = { animal: "owl", bg: "sky", sky: "cloud", ground: "grass", rare: false } as const;
const view = (n: number): DrawView => ({
  picks: Array.from({ length: n }, (_, i) => ({
    card: { id: `b${i}`, entry: "target" as const, title: `책 ${i}`, author: `저자 ${i}`, genre: "통계", field: "데이터·통계", oneLiner: `한 줄 ${i}`, oneLinerStyle: "summary" as const },
    kind: "recommended" as const,
    art,
  })),
  exhausted: false, found: null, keywords: [],
});
const first: FlowState = {
  ...INITIAL, step: "first", entry: "target", opened: true, status: "ready", drawId: 1, draw: view(5),
  form: { topic: "통계", free: null, len: "thin", way: null },
};
const handlers = () => ({ onOpen: vi.fn(), onEdit: vi.fn(), onNext: vi.fn(), onRetry: vi.fn(), onReact: vi.fn(), onHome: vi.fn() });

describe("BookScene", () => {
  it("S-03: the closed book is the thing to press", () => {
    const h = handlers();
    render(<BookScene state={{ ...first, step: "book", opened: false, status: "loading", draw: null }} {...h} />);
    expect(screen.getByText("눌러서 펼치기")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "당신이 찾는 책" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "책 펼치기" }));
    expect(h.onOpen).toHaveBeenCalledTimes(1);
  });

  it("S-04: the title page faces the summary once the book is open", () => {
    render(<BookScene state={{ ...first, entry: "leaf", choices: ["A", "A", "A", "A", "A", "A", "A", "A", "A"] }} {...handlers()} />);
    const heading = screen.getByRole("heading", { name: "당신이 찾는 책" });
    const summaryPage = screen.getByText("분량").closest("ul")?.parentElement;
    expect(summaryPage).toBeTruthy();
    expect(summaryPage?.contains(heading)).toBe(false);
  });

  it("S-04: summary on the page, one edit and the next page below the book", () => {
    const h = handlers();
    render(<BookScene state={first} {...h} />);
    expect(screen.getByRole("heading", { name: "당신이 찾는 책" })).toBeInTheDocument();
    expect(screen.getByText("얇게")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "한 번 고치기" }));
    fireEvent.click(screen.getByRole("button", { name: "다음 장" }));
    expect(h.onEdit).toHaveBeenCalledTimes(1);
    expect(h.onNext).toHaveBeenCalledTimes(1);
  });

  it("S-04: waits for the draw and hides the edit once it is used", () => {
    render(<BookScene state={{ ...first, status: "loading", draw: null, edited: true }} {...handlers()} />);
    expect(screen.getByRole("button", { name: "다음 장" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "한 번 고치기" })).toBeNull();
  });

  it("S-04: offers 다시 쓰기 with the honest note when the written goal matched nothing", () => {
    const goal = { text: "발표 준비", topic: "데이터 분석" as const, keywords: [], matched: false, method: "word" as const };
    render(<BookScene state={{ ...first, form: { topic: null, free: "발표 준비", len: null, way: null }, goal }} {...handlers()} />);
    expect(screen.getByRole("button", { name: "다시 쓰기" })).toBeInTheDocument();
    expect(screen.getByText("아직 이 주제 책이 없어요. 가장 가까운 '데이터 분석' 책을 펼칠게요")).toBeInTheDocument();
  });

  it("S-04: a failed draw offers a primary retry and a way home, and no dead 다음 장", () => {
    const h = handlers();
    render(<BookScene state={{ ...first, status: "error", draw: null }} {...h} />);
    expect(screen.getByRole("alert")).toHaveTextContent(DRAW_FAILED);
    expect(screen.getByRole("button", { name: "다시 시도" })).toHaveAttribute("data-variant", "primary");
    expect(screen.getByRole("button", { name: "처음으로" })).toHaveAttribute("data-variant", "secondary");
    expect(screen.queryByRole("button", { name: "다음 장" })).toBeNull();
    expect(screen.queryByRole("button", { name: "한 번 고치기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    fireEvent.click(screen.getByRole("button", { name: "처음으로" }));
    expect(h.onRetry).toHaveBeenCalledTimes(1);
    expect(h.onHome).toHaveBeenCalledTimes(1);
  });

  it("S-04: sends the person home when the draw is empty", () => {
    const h = handlers();
    render(<BookScene state={{ ...first, draw: view(0) }} {...h} />);
    expect(screen.getByText(EXHAUSTED_NOTICE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다음 장" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "처음으로" }));
    expect(h.onHome).toHaveBeenCalledTimes(1);
  });

  it("S-04 🍃: the taste summary comes from the raw answers", () => {
    const choices = ["A", "A", "unsure", "B", "A", "B", "unsure", "A", "B"] as FlowState["choices"];
    render(<BookScene state={{ ...first, entry: "leaf", choices }} {...handlers()} />);
    expect(screen.getByText("당신의 책 취향")).toBeInTheDocument();
    expect(screen.getByText("확실히 따뜻함")).toBeInTheDocument();
    expect(screen.getByText("문장 · 몰입 둘 다 좋아요")).toBeInTheDocument();
    expect(screen.getByText("두껍게")).toBeInTheDocument();
  });

  it("S-05: the bookmark sits on the book, pass / curious below, with the count of a short draw", () => {
    render(<BookScene state={{ ...first, step: "bookmarks", index: 1, draw: view(3) }} {...handlers()} />);
    expect(screen.getByRole("article", { name: "책 1, 저자 1, 한 줄 1, 통계" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "패스" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "궁금해요" })).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });
});
