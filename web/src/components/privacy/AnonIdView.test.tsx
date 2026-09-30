import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnonIdView, NO_RECORD } from "./AnonIdView";

const ID = "11111111-1111-4111-8111-111111111111";

describe("AnonIdView", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("says there is no record yet and creates no id when none is stored", () => {
    render(<AnonIdView />);
    expect(screen.getByText(NO_RECORD)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "복사" })).not.toBeInTheDocument();
    expect(localStorage.getItem("galpi.anon")).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("shows the stored id and copies it", async () => {
    localStorage.setItem("galpi.anon", ID);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<AnonIdView />);
    expect(screen.getByText(ID)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "복사" })); });
    expect(writeText).toHaveBeenCalledWith(ID);
    expect(screen.getByRole("button", { name: "복사했어요" })).toBeInTheDocument();
  });

  it("tells the visitor when copying is not possible", async () => {
    localStorage.setItem("galpi.anon", ID);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    render(<AnonIdView />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "복사" })); });
    expect(screen.getByText("복사하지 못했어요. 번호를 길게 눌러 복사해 주세요")).toBeInTheDocument();
  });
});
