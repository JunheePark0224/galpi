import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EXHAUSTED_NOTICE } from "@/lib/recommend";
import { SQL_PATH } from "@/lib/paths/__fixtures__/paths";
import { INITIAL, type DrawView, type FlowState } from "@/lib/flow/state";
import { BookScene, DRAW_FAILED } from "./BookScene";

const art = { animal: "owl", bg: "sky", sky: "cloud", ground: "grass", rare: false } as const;
const view = (n: number, mode: "normal" | "challenge" = "normal"): DrawView => ({
  picks: Array.from({ length: n }, (_, i) => ({
    card: { id: `b${i}`, entry: "target" as const, title: `책 ${i}`, author: `저자 ${i}`, genre: "통계", field: "데이터·통계", oneLiner: `한 줄 ${i}`, oneLinerStyle: "summary" as const },
    kind: "recommended" as const,
    art,
    reason: { label: "나온 이유" as const, items: ["통계"] },
  })),
  exhausted: false,
  path: { crumbs: ["뭔가 배우기", "DB에서 꺼내기"], moods: ["가볍게 한 권"], mode },
});
const first: FlowState = { ...INITIAL, step: "first", answers: SQL_PATH, drawnFor: SQL_PATH, opened: true, status: "ready", drawId: 1, draw: view(5) };
const handlers = () => ({ onOpen: vi.fn(), onBack: vi.fn(), onNext: vi.fn(), onRetry: vi.fn(), onReact: vi.fn(), onHome: vi.fn() });

describe("BookScene", () => {
  it("S-03: the closed book is the thing to press", () => {
    const h = handlers();
    render(<BookScene state={{ ...first, step: "book", opened: false, status: "loading", draw: null }} {...h} />);
    expect(screen.getByText("눌러서 펼치기")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "당신이 고른 길" })).toBeNull();
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
    ])("five tips, hidden from assistive tech, whatever the draw (%s)", (_, state) => {
      const { container } = render(<BookScene state={state} {...handlers()} />);
      expect(tips(container)).toHaveLength(5);
      expect(layers(container).length).toBeGreaterThan(0);
      for (const layer of layers(container)) {
        expect(layer).toHaveAttribute("aria-hidden", "true");
        expect(layer).not.toHaveAttribute("data-open");
      }
      expect(screen.getByRole("button", { name: "책 펼치기" })).toBeEnabled();
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

  it("S-04: the title page faces 당신이 고른 길 — the path and the mood, no book count", () => {
    const { container } = render(<BookScene state={first} {...handlers()} />);
    const heading = screen.getByRole("heading", { name: "당신이 고른 길" });
    const way = screen.getByRole("region", { name: "지나온 길" });
    expect(way).toHaveTextContent("뭔가 배우기DB에서 꺼내기");
    expect(screen.getByRole("region", { name: "기분" })).toHaveTextContent("가볍게 한 권");
    expect(way.parentElement?.contains(heading)).toBe(false);
    expect(container).not.toHaveTextContent(/\d+권/);
    expect(screen.queryByText("평소의 당신과 반대편에서 골랐어요")).toBeNull();
  });

  it("S-04: the challenge route says so in one line", () => {
    render(<BookScene state={{ ...first, draw: view(5, "challenge") }} {...handlers()} />);
    expect(screen.getByText("평소의 당신과 반대편에서 골랐어요")).toBeInTheDocument();
  });

  it("S-04: [← 질문으로 돌아가기] (secondary) and [다음 장] (the one primary) below the book", () => {
    const h = handlers();
    render(<BookScene state={first} {...h} />);
    const back = screen.getByRole("button", { name: "질문으로 돌아가기" });
    expect(back).toHaveTextContent("← 질문으로 돌아가기");
    expect(back).toHaveAttribute("data-variant", "secondary");
    expect(screen.getByRole("button", { name: "다음 장" })).toHaveAttribute("data-variant", "primary");
    fireEvent.click(back);
    fireEvent.click(screen.getByRole("button", { name: "다음 장" }));
    expect(h.onBack).toHaveBeenCalledTimes(1);
    expect(h.onNext).toHaveBeenCalledTimes(1);
  });

  it("S-04: waits for the draw — no path yet, 다음 장 off, the way back stays", () => {
    render(<BookScene state={{ ...first, status: "loading", draw: null }} {...handlers()} />);
    expect(screen.getByRole("button", { name: "다음 장" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "질문으로 돌아가기" })).toBeEnabled();
    expect(screen.queryByRole("region", { name: "지나온 길" })).toBeNull();
  });

  it("S-04: a failed draw offers a primary retry and a way home, and no dead 다음 장", () => {
    const h = handlers();
    render(<BookScene state={{ ...first, status: "error", draw: null }} {...h} />);
    expect(screen.getByRole("alert")).toHaveTextContent(DRAW_FAILED);
    expect(screen.getByRole("button", { name: "다시 시도" })).toHaveAttribute("data-variant", "primary");
    expect(screen.getByRole("button", { name: "처음으로" })).toHaveAttribute("data-variant", "secondary");
    expect(screen.queryByRole("button", { name: "다음 장" })).toBeNull();
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

  it("S-05: the bookmark sits on the book, pass / curious below, with the count of a short draw", () => {
    render(<BookScene state={{ ...first, step: "bookmarks", index: 1, draw: view(3) }} {...handlers()} />);
    expect(screen.getByRole("article", { name: "책 1, 저자 1, 한 줄 1, 통계" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "패스" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "궁금해요" })).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });
});
