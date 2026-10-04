import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Home } from "./Home";

describe("Home (S-01)", () => {
  it("offers one entry with the v2 wording and the line under it (PRD F-01, design 10절)", () => {
    const onStart = vi.fn();
    render(<Home onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: "갈피 잡으러 가기" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(screen.getByText("질문 몇 개면 한 권을 만나요")).toBeInTheDocument();
  });

  it("has no login place of its own — the one entry, then the 갈피 우체통 last (F-26)", () => {
    render(<Home onStart={vi.fn()} />);
    expect(screen.queryByTestId("account-slot")).toBeNull();
    expect(screen.queryByText("로그인")).toBeNull();
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent)).toEqual([
      "갈피 잡으러 가기",
      "갈피 우체통 — 써 보고 느낀 점을 넣어 주세요",
    ]);
    expect(screen.getByRole("heading", { name: "갈피" })).toBeInTheDocument();
    expect(screen.getByText("읽을 책, 갈피가 안 잡힐 때")).toBeInTheDocument();
  });

  it("opens the 갈피 우체통 sheet from S-01 (F-26)", () => {
    render(<Home onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "갈피 우체통 — 써 보고 느낀 점을 넣어 주세요" }));
    expect(screen.getByRole("dialog", { name: "갈피 우체통" })).toBeInTheDocument();
  });

  it("shows no library count below the first fill (F-23 hidden) — the cover keeps the logo", () => {
    render(<Home onStart={vi.fn()} library={null} />);
    expect(screen.queryByText(/갈피의 서재/)).toBeNull();
    expect(screen.queryByText(/새로 꽂혔어요/)).toBeNull();
  });

  it("puts the library count on the cover and today's books on a bookmark (F-23, 시안 B)", () => {
    const { container } = render(<Home onStart={vi.fn()} library={{ total: 1234, today: 12 }} />);
    expect(screen.getByText("갈피의 서재 1,234권 · 오늘 12권이 새로 꽂혔어요")).toBeInTheDocument();
    expect(screen.getByText("오늘 12권이 새로 꽂혔어요", { selector: "[aria-hidden='true']" })).toBeInTheDocument();
    const art = container.querySelector("[data-testid='shelf-book']");
    expect(art).toHaveAttribute("aria-hidden", "true");
    expect(art).toHaveTextContent("갈피의 서재");
    expect(art).toHaveTextContent("1,234권");
    expect(art).toHaveTextContent("+12");
    expect(screen.getAllByRole("button")).toHaveLength(2);   // one entry + 갈피 우체통
  });

  it("leaves out today's bookmark and sentence on a day with no new books", () => {
    const { container } = render(<Home onStart={vi.fn()} library={{ total: 640, today: 0 }} />);
    expect(screen.getByText("갈피의 서재 640권")).toBeInTheDocument();
    expect(screen.queryByText(/새로 꽂혔어요/)).toBeNull();
    expect(container.querySelector("[data-testid='shelf-book']")).not.toHaveTextContent("+");
  });
});
