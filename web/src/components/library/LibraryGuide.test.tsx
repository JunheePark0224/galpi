import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LIBRARY_GUIDE_OK, LIBRARY_GUIDE_STEPS, LIBRARY_GUIDE_TITLE, LibraryGuide } from "./LibraryGuide";

describe("LibraryGuide (C-22)", () => {
  it("shows a made-up example shelf (no titles), three steps and [시작하기] that closes", () => {
    const onClose = vi.fn();
    render(<LibraryGuide onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: LIBRARY_GUIDE_TITLE })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([...LIBRARY_GUIDE_STEPS]);
    expect(LIBRARY_GUIDE_STEPS[2]).toBe("[책갈피 옮기기]를 누르고 끌어서 원하는 자리에 놓아요");   // 10-04: moving is a mode
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();               // no bookmark titles in the example
    fireEvent.click(screen.getByRole("button", { name: LIBRARY_GUIDE_OK }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
