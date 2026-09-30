import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOLD_MS, HoldButton } from "./HoldButton";

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
});
