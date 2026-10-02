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
/** Accessible names compare with spaces folded (the phrase keeps its no-break spaces so it never wraps inside). */
const fold = (name: string) => name.replace(/\s+/g, " ").trim();
/** Every attribute (href, title, aria-*, data-* …) under `root` whose value contains `phrase` — C1: must be none. */
const attributesWith = (root: Element, phrase: string) =>
  [root, ...root.querySelectorAll("*")].flatMap((el) => [...el.attributes].filter((a) => a.value.includes(phrase)).map((a) => `${el.tagName}[${a.name}]`));
/** Text nodes containing `phrase` that are not inside a Session Replay mask (data-amp-mask) — must be none. */
const textOutsideMask = (root: Element, phrase: string) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.textContent?.includes(phrase) && !n.parentElement?.closest("[data-amp-mask]")) out.push(n.textContent);
  }
  return out;
};
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

  describe("C-19: five bookmark tips tucked into the closed book", () => {
    const tips = (c: HTMLElement) => c.querySelectorAll("[data-tip]");
    const layers = (c: HTMLElement) => [...c.querySelectorAll("[data-cover-peeks]")];
    const closed = (over: Partial<FlowState>): FlowState => ({ ...first, step: "book", opened: false, ...over });

    it.each([
      ["loading", closed({ status: "loading", draw: null })],
      ["failed", closed({ status: "error", draw: null })],
      ["ready", closed({})],
      ["F-24 ③ (no draw)", closed({
        ...written(g({ text: "캠핑 장비 고르기", topic: "취업·커리어", keywords: [], matched: false, missing: "캠핑 장비" }), { draw: null }),
        step: "book", opened: false,
      })],
    ])("five tips, hidden from assistive tech, whatever the draw (%s)", (_, state) => {
      const { container } = render(<BookScene state={state} {...handlers()} />);
      expect(tips(container)).toHaveLength(5);
      expect(layers(container).length).toBeGreaterThan(0);
      for (const layer of layers(container)) {
        expect(layer).toHaveAttribute("aria-hidden", "true");
        expect(layer).not.toHaveAttribute("data-open");
      }
      expect(screen.getByRole("button", { name: "책 펼치기" })).toBeEnabled();   // the cover stays the one thing to press
    });

    it("shows nothing of the draw: no titles, no art", () => {
      const { container } = render(<BookScene state={closed({})} {...handlers()} />);
      const html = layers(container).map((l) => l.outerHTML).join("");
      expect(html).not.toContain("책 0");
      expect(html).not.toContain("/animals/");
      expect(container.querySelectorAll("[data-cover-peeks] article")).toHaveLength(0);
    });

    it("fade out once the book is open (S-04), and are gone from S-05 on", () => {
      const { container, rerender } = render(<BookScene state={first} {...handlers()} />);
      for (const layer of layers(container)) expect(layer).toHaveAttribute("data-open", "");
      rerender(<BookScene state={{ ...first, step: "bookmarks", index: 0 }} {...handlers()} />);
      expect(layers(container)).toHaveLength(0);
    });
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
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const { container } = render(<BookScene state={written(g({ text: "주식 단타 매매법", keywords: [], missing: "단타 매매" }))} {...h} />);
    const block = screen.getByRole("region", { name: "이렇게 이해했어요" });
    expect(block).toHaveTextContent("돈·경제 › 돈 관리·투자 › 단타 매매 · 아직 없어요");
    expect(block).not.toHaveTextContent("찾았어요");
    expect(block).toHaveTextContent("비슷한 '돈 관리·투자' 책을 펼칠게요");
    // a button, not a link: no href carries the visitor's phrase; the ↗ is hidden from screen readers
    expect(screen.queryByRole("link")).toBeNull();
    const button = screen.getByRole("button", { name: (name) => fold(name) === "예스24에서 '단타 매매' 찾기" });
    expect(button).toHaveTextContent("예스24에서 '단타 매매' 찾기 ↗");
    expect(attributesWith(container, "단타")).toEqual([]);
    expect(textOutsideMask(container, "단타")).toEqual([]);
    fireEvent.click(button);
    expect(h.onYes24).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(
      "https://www.yes24.com/Product/Search?domain=BOOK&query=%EB%8B%A8%ED%83%80%20%EB%A7%A4%EB%A7%A4", "_blank", "noopener,noreferrer",
    );
    expect(open.mock.calls[0][0]).not.toContain(encodeURIComponent("주식 단타 매매법"));
    expect(screen.getByRole("button", { name: "다음 장" })).toBeInTheDocument();
    open.mockRestore();
  });

  it("F-24 ③: no path, no draw, no 다음 장 — YES24 first (primary), then 다른 말로 쓰기 and 🍃 그냥 한 권", () => {
    const h = handlers();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const none = g({ text: "캠핑 장비 고르기", topic: "취업·커리어", keywords: [], matched: false, missing: "캠핑 장비" });
    const { container } = render(<BookScene state={written(none, { draw: null })} {...h} />);
    expect(screen.getByRole("region", { name: "이렇게 이해했어요" })).toHaveTextContent("아직 갈피가 다루지 않는 주제예요");
    expect(screen.queryByText(/›/)).toBeNull();
    expect(screen.queryByText(/아직 이 주제 책이 없어요/)).toBeNull();
    expect(screen.queryByRole("button", { name: "다음 장" })).toBeNull();
    expect(screen.queryByRole("button", { name: "한 번 고치기" })).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    const yes24 = screen.getByRole("button", { name: "예스24에서 찾기" });
    expect(yes24).toHaveTextContent("예스24에서 찾기 ↗");
    expect(yes24).toHaveAttribute("data-variant", "primary");
    expect(container.querySelector("[data-exits]")).not.toBeNull();
    expect(attributesWith(container, "캠핑")).toEqual([]);
    expect(textOutsideMask(container, "캠핑")).toEqual([]);
    fireEvent.click(yes24);
    expect(open).toHaveBeenCalledWith(
      "https://www.yes24.com/Product/Search?domain=BOOK&query=%EC%BA%A0%ED%95%91%20%EC%9E%A5%EB%B9%84", "_blank", "noopener,noreferrer",
    );
    fireEvent.click(screen.getByRole("button", { name: "다른 말로 쓰기" }));
    fireEvent.click(screen.getByRole("button", { name: "🍃 그냥 한 권" }));
    expect(h.onYes24).toHaveBeenCalledTimes(1);
    expect(h.onEdit).toHaveBeenCalledTimes(1);
    expect(h.onLeaf).toHaveBeenCalledTimes(1);
    open.mockRestore();
  });

  it("F-24 ③: YES24's front page without a phrase, and no 다른 말로 쓰기 once the one edit is used", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const none = g({ text: "아무거나", keywords: [], matched: false, missing: null });
    render(<BookScene state={written(none, { draw: null, edited: true })} {...handlers()} />);
    fireEvent.click(screen.getByRole("button", { name: "예스24에서 찾기" }));
    expect(open).toHaveBeenCalledWith("https://www.yes24.com/", "_blank", "noopener,noreferrer");
    expect(screen.queryByRole("button", { name: "다른 말로 쓰기" })).toBeNull();
    expect(screen.getByRole("button", { name: "🍃 그냥 한 권" })).toBeInTheDocument();
    open.mockRestore();
  });

  it("F-24: a word-match miss (any fallback) is not ③ — the nearest topic's books open with the old honest line", () => {
    const miss = g({ text: "발표 준비", topic: "데이터 분석", keywords: [], matched: false, missing: null, method: "word" });
    render(<BookScene state={written(miss)} {...handlers()} />);
    const block = screen.getByRole("region", { name: "이렇게 이해했어요" });
    expect(block).toHaveTextContent("아직 이 주제 책이 없어요. 가장 가까운 '데이터 분석' 책을 펼칠게요");
    expect(block).not.toHaveTextContent("아직 갈피가 다루지 않는 주제예요");
    expect(screen.queryByText(/›/)).toBeNull();
    expect(screen.getByRole("button", { name: "다시 쓰기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 장" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "예스24에서 찾기" })).toBeNull();
  });

  it("F-24: the block is named by its visible label once (aria-labelledby, no repeated aria-label)", () => {
    render(<BookScene state={written(g({}))} {...handlers()} />);
    const block = screen.getByRole("region", { name: "이렇게 이해했어요" });
    expect(block).not.toHaveAttribute("aria-label");
    expect(document.getElementById(block.getAttribute("aria-labelledby") ?? "")).toHaveTextContent("이렇게 이해했어요");
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
