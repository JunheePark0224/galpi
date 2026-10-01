import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EXHAUSTED_NOTICE } from "@/lib/recommend";
import { INITIAL, type DrawView, type FlowState } from "@/lib/flow/state";
import type { GoalMatch } from "@/lib/goal/match";
import { BookScene, DRAW_FAILED } from "./BookScene";

const art = { animal: "owl", bg: "sky", sky: "cloud", ground: "grass", rare: false } as const;
const view = (n: number): DrawView => ({
  picks: Array.from({ length: n }, (_, i) => ({
    card: { id: `b${i}`, entry: "target" as const, title: `책 ${i}`, author: `저자 ${i}`, genre: "통계", field: "데이터·통계", oneLiner: `한 줄 ${i}`, oneLinerStyle: "summary" as const },
    kind: "recommended" as const,
    art,
    reason: { label: "나온 이유" as const, items: ["통계"] },
  })),
  exhausted: false, found: null, keywords: [],
});
const first: FlowState = {
  ...INITIAL, step: "first", entry: "target", opened: true, status: "ready", drawId: 1, draw: view(5),
  form: { topic: "통계", free: null, len: "thin", way: null },
};
const handlers = () => ({
  onOpen: vi.fn(), onEdit: vi.fn(), onNext: vi.fn(), onRetry: vi.fn(), onReact: vi.fn(), onHome: vi.fn(), onYes24: vi.fn(), onLeaf: vi.fn(),
});
const written = (goal: GoalMatch, over: Partial<FlowState> = {}): FlowState =>
  ({ ...first, form: { topic: null, free: goal.text, len: "thin", way: null }, goal, ...over });
const g = (over: Partial<GoalMatch>): GoalMatch =>
  ({ text: "주식 처음", topic: "돈 관리·투자", keywords: ["주식"], matched: true, missing: null, method: "llm", ...over });

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

  it("F-24 ①: the path reaches the keyword under the 무엇을 row; the usual edit and next page stay", () => {
    render(<BookScene state={written(g({}))} {...handlers()} />);
    const block = screen.getByRole("region", { name: "이렇게 이해했어요" });
    expect(block).toHaveTextContent("이렇게 이해했어요돈·경제 › 돈 관리·투자 › 주식으로 찾았어요");
    expect(screen.getByRole("button", { name: "한 번 고치기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 장" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("F-24 ①+: the count of keyword books is a line under the path, not a slip", () => {
    const draw = { ...view(5), found: 2, keywords: ["주식"], exhausted: true };
    render(<BookScene state={written(g({}), { draw })} {...handlers()} />);
    const block = screen.getByRole("region", { name: "이렇게 이해했어요" });
    expect(block).toHaveTextContent("주식 책은 아직 2권이에요. 나머지는 가까운 '돈 관리·투자' 책이에요");
    expect(screen.queryByRole("status")).toBeNull();     // no C-14 slip, and no exhausted notice in the same round
  });

  it("F-24 ②: the missing thing in a dashed segment, similar books, and a YES24 search for that phrase only", () => {
    const h = handlers();
    render(<BookScene state={written(g({ text: "주식 단타 매매법", keywords: [], missing: "단타 매매" }))} {...h} />);
    const block = screen.getByRole("region", { name: "이렇게 이해했어요" });
    expect(block).toHaveTextContent("돈·경제 › 돈 관리·투자 › 단타 매매 · 아직 없어요");
    expect(block).not.toHaveTextContent("찾았어요");
    expect(block).toHaveTextContent("비슷한 '돈 관리·투자' 책을 펼칠게요");
    // the phrase keeps its no-break space (it never wraps inside); names compare with spaces folded
    const link = screen.getByRole("link", { name: (name) => name.replace(/\s+/g, " ") === "예스24에서 '단타 매매' 찾기 ↗" });
    const url = new URL(link.getAttribute("href") ?? "");
    expect(url.searchParams.get("query")).toBe("단타 매매");
    expect(link).toHaveAttribute("target", "_blank");
    fireEvent.click(link);
    expect(h.onYes24).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "다음 장" })).toBeInTheDocument();
  });

  it("F-24 ③: no path, no draw, no 다음 장 — YES24 first (primary), then 다른 말로 쓰기 and 🍃 그냥 한 권", () => {
    const h = handlers();
    const none = g({ text: "캠핑 장비 고르기", topic: "취업·커리어", keywords: [], matched: false, missing: "캠핑 장비" });
    const { container } = render(<BookScene state={written(none, { draw: null })} {...h} />);
    expect(screen.getByRole("region", { name: "이렇게 이해했어요" })).toHaveTextContent("아직 갈피가 다루지 않는 주제예요");
    expect(screen.queryByText(/›/)).toBeNull();
    expect(screen.queryByText("아직 이 주제 책이 없어요. 가장 가까운 '취업·커리어' 책을 펼칠게요")).toBeNull();
    expect(screen.queryByRole("button", { name: "다음 장" })).toBeNull();
    expect(screen.queryByRole("button", { name: "한 번 고치기" })).toBeNull();
    const buttons = screen.getAllByRole("button").concat(screen.getAllByRole("link"));
    expect(buttons.map((b) => b.textContent)).toEqual(expect.arrayContaining(["예스24에서 찾기 ↗", "다른 말로 쓰기", "🍃 그냥 한 권"]));
    const yes24 = screen.getByRole("link", { name: "예스24에서 찾기 ↗" });
    expect(yes24).toHaveAttribute("data-variant", "primary");
    expect(new URL(yes24.getAttribute("href") ?? "").searchParams.get("query")).toBe("캠핑 장비");
    expect(container.querySelector("[data-exits]")).not.toBeNull();
    fireEvent.click(yes24);
    fireEvent.click(screen.getByRole("button", { name: "다른 말로 쓰기" }));
    fireEvent.click(screen.getByRole("button", { name: "🍃 그냥 한 권" }));
    expect(h.onYes24).toHaveBeenCalledTimes(1);
    expect(h.onEdit).toHaveBeenCalledTimes(1);
    expect(h.onLeaf).toHaveBeenCalledTimes(1);
  });

  it("F-24 ③: YES24's front page without a phrase, and no 다른 말로 쓰기 once the one edit is used", () => {
    const none = g({ text: "아무거나", keywords: [], matched: false, missing: null, method: "word" });
    render(<BookScene state={written(none, { draw: null, edited: true })} {...handlers()} />);
    expect(screen.getByRole("link", { name: "예스24에서 찾기 ↗" })).toHaveAttribute("href", "https://www.yes24.com/");
    expect(screen.queryByRole("button", { name: "다른 말로 쓰기" })).toBeNull();
    expect(screen.getByRole("button", { name: "🍃 그냥 한 권" })).toBeInTheDocument();
  });

  it("F-24: an untouched example chip gets one short line", () => {
    render(<BookScene state={written(g({ text: "돈 관리", keywords: [], method: "example" }))} {...handlers()} />);
    expect(screen.getByText("→ 돈 관리·투자로 찾았어요")).toBeInTheDocument();
    expect(screen.queryByText("이렇게 이해했어요")).toBeNull();
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
