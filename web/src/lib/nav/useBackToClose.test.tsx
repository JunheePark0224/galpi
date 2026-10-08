import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetBackHolds } from "./deviceBack";
import { useBackToClose } from "./useBackToClose";

function Open({ onClose }: { onClose: () => void }) {
  useBackToClose(onClose);
  return <p>open</p>;
}
const pressBack = () => window.dispatchEvent(new PopStateEvent("popstate", { state: null }));

describe("useBackToClose (10-08)", () => {
  afterEach(() => { vi.restoreAllMocks(); forgetBackHolds(); });

  it("the phone's back key closes the open window", () => {
    vi.spyOn(window.history, "pushState");
    const onClose = vi.fn();
    render(<Open onClose={onClose} />);
    pressBack();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closed by its own button, it gives its history entry back", () => {
    vi.spyOn(window.history, "pushState");
    const back = vi.spyOn(window.history, "back").mockImplementation(() => pressBack());
    const onClose = vi.fn();
    const { unmount } = render(<Open onClose={onClose} />);
    unmount();
    expect(back).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
