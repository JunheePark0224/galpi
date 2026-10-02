import { act, fireEvent, render, screen } from "@testing-library/react";
import { IDENTITY_ORDER } from "@/lib/flow/order";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "@/lib/track/client";
import { BalanceGame, HOLD_HINT, TAP_GUARD_MS } from "./BalanceGame";

vi.mock("@/lib/track/client", () => ({ track: vi.fn() }));

/** Time passes only when told: the guard reads performance.now(), which the fake clock controls. */
const settle = () => act(() => { vi.advanceTimersByTime(TAP_GUARD_MS); });

describe("BalanceGame", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("asks question 1 with A on the left and logs the answer", () => {
    const onAnswer = vi.fn();
    render(<BalanceGame order={IDENTITY_ORDER} choices={[]} edit={false} onAnswer={onAnswer} />);
    settle();
    expect(screen.getByRole("heading", { name: "책을 덮은 뒤, 남았으면 하는 건?" })).toBeInTheDocument();
    expect(screen.getByText("1 / 9")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "몽글몽글 따뜻함" }));
    expect(onAnswer).toHaveBeenCalledWith("A");
    expect(track).toHaveBeenCalledWith("balance_answered", { question_no: 1, position: 1, choice: "A", side: "left", elapsed_ms: expect.any(Number), is_edit: false });
  });

  it("puts A on the right from question 5", () => {
    const onAnswer = vi.fn();
    const { container } = render(<BalanceGame order={IDENTITY_ORDER} choices={["A", "A", "A", "A"]} edit onAnswer={onAnswer} />);
    settle();
    expect(container.querySelector('[data-side="left"]')).toHaveTextContent("빗소리처럼 쓸쓸한 책");
    fireEvent.click(screen.getByRole("button", { name: "빗소리처럼 쓸쓸한 책" }));
    expect(onAnswer).toHaveBeenCalledWith("B");
    expect(track).toHaveBeenCalledWith("balance_answered", expect.objectContaining({ question_no: 5, position: 5, choice: "B", side: "left", is_edit: true }));
  });

  it("answers 못 잡겠어요 after the hold and logs a cancelled hold before it", () => {
    const onAnswer = vi.fn();
    render(<BalanceGame order={IDENTITY_ORDER} choices={["A"]} edit={false} onAnswer={onAnswer} />);
    const hold = screen.getByRole("button", { name: "갈피를 못 잡겠어요" });
    fireEvent.pointerDown(hold);
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.pointerUp(hold);
    expect(track).toHaveBeenCalledWith("unsure_hold_cancelled", { question_no: 2, position: 2, held_ms: expect.any(Number), is_edit: false });
    fireEvent.pointerDown(hold);
    act(() => { vi.advanceTimersByTime(800); });
    expect(onAnswer).toHaveBeenCalledWith("unsure");
    expect(track).toHaveBeenCalledWith("balance_answered", expect.objectContaining({ question_no: 2, choice: "unsure", side: null }));
  });

  it("draws each choice as a bookmark with the words in its window and no animal", () => {
    render(<BalanceGame order={IDENTITY_ORDER} choices={["A"]} edit={false} onAnswer={vi.fn()} />);
    const card = screen.getByRole("button", { name: "다음 장이 궁금해 못 자는 밤" });
    expect(card).toHaveTextContent(/^다음 장이 궁금해 못 자는 밤$/);   // nothing else on the card: no tag, title or one-liner
    expect(card.querySelector("svg, image, img")).toBeNull();
    expect(card).toHaveAttribute("data-side", "right");
  });

  it("holds the hint copy in one constant", () => {
    render(<BalanceGame order={IDENTITY_ORDER} choices={[]} edit={false} onAnswer={vi.fn()} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "갈피를 못 잡겠어요" }));
    expect(screen.getByRole("status")).toHaveTextContent(HOLD_HINT);
  });

  it("marks answered and 못 잡겠어요 cells in the progress bar", () => {
    const { container } = render(<BalanceGame order={IDENTITY_ORDER} choices={["A", "unsure", "B"]} edit={false} onAnswer={vi.fn()} />);
    expect(container.querySelectorAll('[data-state="done"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-state="unsure"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-state="now"]')).toHaveLength(1);
  });

  it("records one answer for two taps 100 ms apart, then takes a tap once the guard has passed", () => {
    const onAnswer = vi.fn();
    const { rerender } = render(<BalanceGame order={IDENTITY_ORDER} choices={[]} edit={false} onAnswer={onAnswer} />);
    settle();
    fireEvent.click(screen.getByRole("button", { name: "몽글몽글 따뜻함" }));         // tap 1 answers question 1
    rerender(<BalanceGame order={IDENTITY_ORDER} choices={["A"]} edit={false} onAnswer={onAnswer} />);      // question 2 appears
    const card = () => screen.getByRole("button", { name: "밑줄 긋고 싶은 문장" });
    act(() => { vi.advanceTimersByTime(100); });
    fireEvent.click(card());                                                        // tap 2, 100 ms later: still the double tap
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(TAP_GUARD_MS - 100 - 1); });
    fireEvent.click(card());
    expect(onAnswer).toHaveBeenCalledTimes(1);                                      // 1 ms short of the guard
    act(() => { vi.advanceTimersByTime(1); });
    fireEvent.click(card());
    expect(onAnswer).toHaveBeenCalledTimes(2);
    expect(onAnswer).toHaveBeenLastCalledWith("A");
    expect(track).toHaveBeenLastCalledWith("balance_answered", expect.objectContaining({ question_no: 2, choice: "A" }));
  });

  it("asks in this pass's order and logs the question number with the place it was shown (v0.9)", () => {
    const onAnswer = vi.fn();
    render(<BalanceGame order={[8, 4, 0, 5, 1, 6, 2, 7, 3]} choices={["A"]} edit={false} onAnswer={onAnswer} />);
    expect(screen.getByRole("heading", { name: "비 오는 날 창가에서 펼칠 책은?" })).toBeInTheDocument();   // question 5, shown 2nd
    expect(screen.getByText("2 / 9")).toBeInTheDocument();
    settle();
    fireEvent.click(screen.getByRole("button", { name: "담요처럼 포근한 책" }));             // question 5 keeps A on the right
    expect(onAnswer).toHaveBeenCalledWith("A");
    expect(track).toHaveBeenCalledWith("balance_answered", expect.objectContaining({ question_no: 5, position: 2, choice: "A", side: "right" }));
  });
});

