import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOLD_MS, useHold } from "./useHold";

function Probe({ onHold, onClick }: { onHold: (at: { x: number; y: number }) => void; onClick: () => void }) {
  const hold = useHold(onHold);
  return <button type="button" {...hold.handlers} onClick={() => { if (!hold.wasHold()) onClick(); }}>bm</button>;
}

describe("useHold — 꾹 누르기 (0.5 s) without fighting the sideways scroll", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const onHold = vi.fn();
    const onClick = vi.fn();
    render(<Probe onHold={onHold} onClick={onClick} />);
    return { onHold, onClick, el: screen.getByRole("button") };
  };

  it("holds after 0.5 s of a still press, and the click that follows the release is not a tap", () => {
    const { onHold, onClick, el } = setup();
    expect(HOLD_MS).toBe(500);
    fireEvent.pointerDown(el, { clientX: 10, clientY: 10, pointerType: "touch" });
    fireEvent.pointerMove(el, { clientX: 13, clientY: 14 });
    act(() => { vi.advanceTimersByTime(499); });
    expect(onHold).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onHold).toHaveBeenCalledTimes(1);
    expect(onHold).toHaveBeenCalledWith({ x: 13, y: 14 });              // the drag starts where the finger is now
    fireEvent.pointerUp(el);
    fireEvent.click(el);
    expect(onClick).not.toHaveBeenCalled();
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("a short press is a tap", () => {
    const { onHold, onClick, el } = setup();
    fireEvent.pointerDown(el, { clientX: 10, clientY: 10 });
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.pointerUp(el);
    fireEvent.click(el);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onHold).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("moving more than 10 px is a scroll, not a hold", () => {
    const { onHold, el } = setup();
    fireEvent.pointerDown(el, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(el, { clientX: 15, clientY: 13 });
    fireEvent.pointerMove(el, { clientX: 25, clientY: 10 });
    act(() => { vi.advanceTimersByTime(600); });
    expect(onHold).not.toHaveBeenCalled();
  });

  it("a cancelled pointer (the browser took over to scroll) is not a hold, and no context menu opens while holding", () => {
    const { onHold, el } = setup();
    fireEvent.pointerDown(el, { clientX: 10, clientY: 10 });
    fireEvent.pointerCancel(el);
    act(() => { vi.advanceTimersByTime(600); });
    expect(onHold).not.toHaveBeenCalled();
    const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    el.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
  });

  it("ignores a secondary mouse button", () => {
    const { onHold, el } = setup();
    fireEvent.pointerDown(el, { clientX: 10, clientY: 10, button: 2, pointerType: "mouse" });
    act(() => { vi.advanceTimersByTime(600); });
    expect(onHold).not.toHaveBeenCalled();
  });
});
