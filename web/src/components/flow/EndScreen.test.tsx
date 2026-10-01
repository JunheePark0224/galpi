import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { END_NOTE, END_TITLE, EndScreen } from "./EndScreen";

describe("EndScreen (S-08)", () => {
  it("offers 다시 뽑기 as the main button and 처음으로 beside it", () => {
    const onRedraw = vi.fn();
    const onHome = vi.fn();
    render(<EndScreen onRedraw={onRedraw} onHome={onHome} />);
    expect(screen.getByRole("heading", { level: 1, name: END_TITLE })).toBeInTheDocument();
    expect(screen.getByText(END_NOTE)).toBeInTheDocument();
    const redraw = screen.getByRole("button", { name: "다시 뽑기" });
    expect(redraw).toHaveAttribute("data-variant", "primary");
    expect(screen.getByRole("button", { name: "처음으로" })).toHaveAttribute("data-variant", "secondary");
    fireEvent.click(redraw);
    fireEvent.click(screen.getByRole("button", { name: "처음으로" }));
    expect(onRedraw).toHaveBeenCalledTimes(1);
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});
