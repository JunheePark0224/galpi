import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Home } from "./Home";

describe("Home (S-01)", () => {
  it("offers the two entries with their PRD wording", () => {
    const onStart = vi.fn();
    render(<Home onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: /알고 싶은 게 있어요.*배우고 싶은 주제로, 아직 모르는 책 만나기/ }));
    fireEvent.click(screen.getByRole("button", { name: /그냥 한 권 만나고 싶어요.*밸런스 게임으로 내 취향에 맞는 한 권 만나기/ }));
    expect(onStart.mock.calls).toEqual([["target"], ["leaf"]]);
  });

  it("keeps the top-right login place empty and not clickable (P5)", () => {
    render(<Home onStart={vi.fn()} />);
    expect(screen.getByTestId("account-slot")).toBeEmptyDOMElement();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "갈피" })).toBeInTheDocument();
    expect(screen.getByText("읽을 책, 갈피가 안 잡힐 때")).toBeInTheDocument();
  });
});
