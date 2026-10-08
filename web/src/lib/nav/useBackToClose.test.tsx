import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetBackHolds } from "./deviceBack";
import { useBackToClose } from "./useBackToClose";

function Open({ onClose }: { onClose: () => void }) {
  useBackToClose(onClose);
  return <p>open</p>;
}
/** The browser's back key: a real history move (jsdom fires popstate a moment later). */
const pressBack = async () => {
  const popped = new Promise((r) => window.addEventListener("popstate", r, { once: true }));
  window.history.back();
  await popped;
};

describe("useBackToClose (10-08)", () => {
  afterEach(() => { vi.restoreAllMocks(); forgetBackHolds(); });

  it("the phone's back key closes the open window", async () => {
    const onClose = vi.fn();
    render(<Open onClose={onClose} />);
    await pressBack();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closed by its own button, it gives its history entry back", () => {
    const back = vi.spyOn(window.history, "back");
    const onClose = vi.fn();
    const { unmount } = render(<Open onClose={onClose} />);
    unmount();
    expect(back).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
