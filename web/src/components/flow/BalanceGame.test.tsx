import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { track } from "@/lib/track/client";
import { BalanceGame } from "./BalanceGame";

vi.mock("@/lib/track/client", () => ({ track: vi.fn() }));

describe("BalanceGame", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("asks question 1 with A on the left and logs the answer", () => {
    const onAnswer = vi.fn();
    render(<BalanceGame choices={[]} edit={false} onAnswer={onAnswer} />);
    expect(screen.getByRole("heading", { name: "책을 덮은 뒤, 남았으면 하는 건?" })).toBeInTheDocument();
    expect(screen.getByText("1 / 9")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "몽글몽글 따뜻함" }));
    expect(onAnswer).toHaveBeenCalledWith("A");
    expect(track).toHaveBeenCalledWith("balance_answered", expect.objectContaining({ question: 1, choice: "A", side: "left", edit: false }));
  });

  it("puts A on the right from question 5", () => {
    const onAnswer = vi.fn();
    const { container } = render(<BalanceGame choices={["A", "A", "A", "A"]} edit onAnswer={onAnswer} />);
    expect(container.querySelector('[data-side="left"]')).toHaveTextContent("빗소리처럼 쓸쓸한 책");
    fireEvent.click(screen.getByRole("button", { name: "빗소리처럼 쓸쓸한 책" }));
    expect(onAnswer).toHaveBeenCalledWith("B");
    expect(track).toHaveBeenCalledWith("balance_answered", expect.objectContaining({ question: 5, choice: "B", side: "left", edit: true }));
  });

  it("answers 못 잡겠어요 after the hold and logs a cancelled hold before it", () => {
    vi.useFakeTimers();
    const onAnswer = vi.fn();
    render(<BalanceGame choices={["A"]} edit={false} onAnswer={onAnswer} />);
    const hold = screen.getByRole("button", { name: "갈피를 못 잡겠어요" });
    fireEvent.pointerDown(hold);
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.pointerUp(hold);
    expect(track).toHaveBeenCalledWith("unsure_hold_cancelled", expect.objectContaining({ question: 2, held_ms: expect.any(Number) }));
    fireEvent.pointerDown(hold);
    act(() => { vi.advanceTimersByTime(800); });
    expect(onAnswer).toHaveBeenCalledWith("unsure");
    expect(track).toHaveBeenCalledWith("balance_answered", expect.objectContaining({ question: 2, choice: "unsure", side: null }));
  });

  it("marks answered and 못 잡겠어요 cells in the progress bar", () => {
    const { container } = render(<BalanceGame choices={["A", "unsure", "B"]} edit={false} onAnswer={vi.fn()} />);
    expect(container.querySelectorAll('[data-state="done"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-state="unsure"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-state="now"]')).toHaveLength(1);
  });
});
