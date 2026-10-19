import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
vi.mock("@/lib/track/client", () => ({ track: (...a: unknown[]) => track(...a) }));
import { latestWeek, NEWS_SEEN_KEY, NEWS_WEEKS, weekLabel } from "@/lib/news/news";
import { NewsOwl } from "./NewsOwl";

const LATEST = latestWeek().start;
const button = () => screen.getByRole("button", { name: /^갈피 소식통 — 이번 주에 바뀐 것/ });
const dot = () => screen.queryByTestId("news-dot");

describe("NewsOwl (S-01, PRD F-28, DESIGN C-33)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.clearAllMocks());

  it("is one quiet button with the owl drawing hidden from screen readers", () => {
    const { container } = render(<NewsOwl />);
    expect(button()).toHaveTextContent("갈피 소식통");
    expect(button()).toHaveTextContent("이번 주에 바뀐 것");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the dot (and says so) to someone who never opened the news", () => {
    render(<NewsOwl />);
    expect(dot()).toBeInTheDocument();
    expect(button()).toHaveAccessibleName("갈피 소식통 — 이번 주에 바뀐 것, 새 소식 있음");
  });

  it("has no dot when the newest week was already opened in this browser", () => {
    localStorage.setItem(NEWS_SEEN_KEY, LATEST);
    render(<NewsOwl />);
    expect(dot()).toBeNull();
    expect(button()).toHaveAccessibleName("갈피 소식통 — 이번 주에 바뀐 것");
  });

  it("opens the sheet with every week, newest first, marks the newest as new, and tracks E-46", () => {
    render(<NewsOwl />);
    fireEvent.click(button());
    const sheet = screen.getByRole("dialog", { name: "갈피 소식통" });
    expect(within(sheet).getByText("한 주 동안 갈피에서 바뀐 것을 모아 전해요.")).toBeInTheDocument();
    const headings = within(sheet).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(NEWS_WEEKS.map((w, i) => (i === 0 ? `${weekLabel(w)}, 새 소식` : weekLabel(w))));
    for (const item of NEWS_WEEKS.flatMap((w) => w.items)) expect(within(sheet).getByText(item)).toBeInTheDocument();
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("news_opened", { has_unseen: true, latest_week: LATEST });
  });

  it("brings the sheet back to the newest week after the sheet focuses its [닫기] at the bottom", () => {
    // jsdom does not scroll on focus: do what a browser does — focusing the bottom button scrolls the dialog down
    const focus = vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (this: HTMLElement) {
      const dialog = this.closest<HTMLElement>("[role='dialog']");
      if (dialog) dialog.scrollTop = 480;
    });
    render(<NewsOwl />);
    fireEvent.click(button());
    expect(focus).toHaveBeenCalled();
    expect(screen.getByRole("dialog").scrollTop).toBe(0);
    focus.mockRestore();
  });

  it("forgets the dot once opened, and does not mark the week as new the next time", () => {
    render(<NewsOwl />);
    fireEvent.click(button());
    expect(localStorage.getItem(NEWS_SEEN_KEY)).toBe(LATEST);
    expect(dot()).toBeNull();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(button());
    expect(within(screen.getByRole("dialog")).queryByText("새 소식")).toBeNull();
    expect(track).toHaveBeenLastCalledWith("news_opened", { has_unseen: false, latest_week: LATEST });
  });
});
