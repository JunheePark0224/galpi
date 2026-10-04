import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QUESTION_MAP } from "@/lib/paths";
import { HOLD_HINT, Question, TAP_GUARD_MS } from "./Question";

const START = QUESTION_MAP.nodes.start;     // 평소 끌리는 쪽으로 / 오늘은 낯선 쪽으로 도전
const settle = () => act(() => { vi.advanceTimersByTime(TAP_GUARD_MS); });
const handlers = () => ({ onAnswer: vi.fn(), onHoldCancel: vi.fn(), onBack: vi.fn() });

describe("Question (S-02)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("asks the question with A on the left and B on the right, each a bookmark card with no picture", () => {
    const { container } = render(<Question node={START} {...handlers()} />);
    expect(screen.getByRole("heading", { level: 1, name: START.question })).toBeInTheDocument();
    expect(container.querySelector('[data-side="left"]')).toHaveTextContent(START.a.label);
    expect(container.querySelector('[data-side="right"]')).toHaveTextContent(START.b.label);
    expect(container.querySelector("svg, image, img")).toBeNull();
  });

  it("shows no path and no count while answering (design 10절)", () => {
    const { container } = render(<Question node={QUESTION_MAP.nodes["learn-data-tool"]} {...handlers()} />);
    expect(container).not.toHaveTextContent(/\d+\s*\/\s*\d+/);
    expect(container).not.toHaveTextContent("›");
    expect(container.querySelector("ol, progress")).toBeNull();
  });

  it("answers A or B with the time it took, once the tap guard has passed", () => {
    const h = handlers();
    render(<Question node={START} {...h} />);
    fireEvent.click(screen.getByRole("button", { name: START.a.label }));          // a double tap's tail: ignored
    expect(h.onAnswer).not.toHaveBeenCalled();
    settle();
    fireEvent.click(screen.getByRole("button", { name: START.b.label }));
    expect(h.onAnswer).toHaveBeenCalledWith("B", TAP_GUARD_MS);
  });

  it("answers 갈피를 못 잡겠어요 after the hold, and reports a hold let go too early", () => {
    const h = handlers();
    render(<Question node={START} {...h} />);
    const hold = screen.getByRole("button", { name: "갈피를 못 잡겠어요" });
    fireEvent.pointerDown(hold);
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.pointerUp(hold);
    expect(h.onHoldCancel).toHaveBeenCalledWith(expect.any(Number));
    fireEvent.pointerDown(hold);
    expect(screen.getByRole("status")).toHaveTextContent(HOLD_HINT);
    act(() => { vi.advanceTimersByTime(800); });
    expect(h.onAnswer).toHaveBeenCalledWith("unsure", expect.any(Number));
  });

  it("moves focus to the question heading when a question appears, without scrolling to it", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const h = handlers();
    const { rerender } = render(<Question key="start" node={START} {...h} />);
    const first = screen.getByRole("heading", { level: 1, name: START.question });
    expect(first).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(first);
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    const branch = QUESTION_MAP.nodes.branch;
    rerender(<Question key="branch" node={branch} {...h} />);           // Flow's new key per question shown
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: branch.question }));
    focus.mockRestore();
  });

  it("offers [← 이전 질문] on every question, 44px tall by its class", () => {
    const h = handlers();
    render(<Question node={START} {...h} />);
    const back = screen.getByRole("button", { name: "이전 질문" });
    expect(back).toHaveTextContent("← 이전 질문");
    fireEvent.click(back);
    expect(h.onBack).toHaveBeenCalledTimes(1);
  });
});
