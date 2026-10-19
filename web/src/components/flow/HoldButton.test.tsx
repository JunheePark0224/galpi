import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOLD_MS, HoldButton, TAP_HINT_MS } from "./HoldButton";

describe("HoldButton", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const onHold = vi.fn();
    const onCancel = vi.fn();
    render(<HoldButton label="갈피를 못 잡겠어요" onHold={onHold} onCancel={onCancel} />);
    return { onHold, onCancel, button: screen.getByRole("button", { name: "갈피를 못 잡겠어요" }) };
  };

  it("fires once the 0.8s timer runs out, not before", () => {
    const { onHold, onCancel, button } = setup();
    fireEvent.pointerDown(button);
    act(() => { vi.advanceTimersByTime(HOLD_MS - 1); });
    expect(onHold).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onHold).toHaveBeenCalledTimes(1);
    fireEvent.pointerUp(button);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("reports a release before 0.8s as a cancel", () => {
    const { onHold, onCancel, button } = setup();
    fireEvent.pointerDown(button);
    act(() => { vi.advanceTimersByTime(300); });
    fireEvent.pointerUp(button);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onHold).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledWith(expect.any(Number));
  });

  // 10-14: 26 of 132 people tapped it (83 times, median 0.1 s) and saw nothing — the hold hint only shows while pressing.
  it("a quick tap leaves the tap hint for 2 s, then the label comes back", () => {
    render(<HoldButton label="갈피를 못 잡겠어요" tapHint="끌리는 쪽을 골라 주세요 · 모르겠으면 꾹" onHold={vi.fn()} onCancel={vi.fn()} />);
    const button = screen.getByRole("button", { name: "갈피를 못 잡겠어요" });
    fireEvent.pointerDown(button);
    act(() => { vi.advanceTimersByTime(100); });
    fireEvent.pointerUp(button);
    expect(button).toHaveAttribute("data-nudge");
    expect(screen.getByRole("status")).toHaveTextContent("끌리는 쪽을 골라 주세요 · 모르겠으면 꾹");
    act(() => { vi.advanceTimersByTime(TAP_HINT_MS); });
    expect(button).not.toHaveAttribute("data-nudge");
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("a release after a real press shows no tap hint", () => {
    render(<HoldButton label="갈피를 못 잡겠어요" tapHint="끌리는 쪽을 골라 주세요 · 모르겠으면 꾹" onHold={vi.fn()} onCancel={vi.fn()} />);
    const button = screen.getByRole("button", { name: "갈피를 못 잡겠어요" });
    fireEvent.pointerDown(button);
    act(() => { vi.advanceTimersByTime(500); });
    fireEvent.pointerUp(button);
    expect(button).not.toHaveAttribute("data-nudge");
  });

  it("holds with Enter and ignores key repeat", () => {
    const { onHold, button } = setup();
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyDown(button, { key: "Enter", repeat: true });
    act(() => { vi.advanceTimersByTime(HOLD_MS); });
    expect(onHold).toHaveBeenCalledTimes(1);
  });

  it("blocks the long-press menu and shows the gauge only while holding", () => {
    const { button } = setup();
    expect(fireEvent.contextMenu(button)).toBe(false);
    fireEvent.pointerDown(button);
    expect(button).toHaveAttribute("data-holding");
    fireEvent.pointerUp(button);
    expect(button).not.toHaveAttribute("data-holding");
  });

  it("does not start a hold from a right or middle click", () => {
    const { onHold, onCancel, button } = setup();
    fireEvent.pointerDown(button, { button: 2 });
    fireEvent.pointerDown(button, { button: 1 });
    expect(button).not.toHaveAttribute("data-holding");
    act(() => { vi.advanceTimersByTime(HOLD_MS * 2); });
    fireEvent.pointerUp(button, { button: 2 });
    expect(onHold).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("shows the faint hint in its own box while held, keeps its name, and restores the label on release", () => {
    const hint = "끌리는 쪽을 고를수록 더 잘 맞아요";
    render(<HoldButton label="갈피를 못 잡겠어요" hint={hint} onHold={vi.fn()} onCancel={vi.fn()} />);
    const button = screen.getByRole("button", { name: "갈피를 못 잡겠어요" });
    expect(within(button).getByText(hint)).toBeInTheDocument();          // laid out from the start: no jump when it shows
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    fireEvent.pointerDown(button);
    expect(button).toHaveAttribute("data-holding");
    expect(button).toHaveAccessibleName("갈피를 못 잡겠어요");
    expect(screen.getByRole("status")).toHaveTextContent(hint);         // announced politely, once per hold
    fireEvent.pointerUp(button);
    expect(button).not.toHaveAttribute("data-holding");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("still holds from the primary button (touch and left click are button 0)", () => {
    const { onHold, button } = setup();
    fireEvent.pointerDown(button, { button: 0 });
    act(() => { vi.advanceTimersByTime(HOLD_MS); });
    expect(onHold).toHaveBeenCalledTimes(1);
  });
});
