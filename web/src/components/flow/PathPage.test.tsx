import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CHALLENGE_LINE, MOOD_ANY, PathPage, WHOLE_LIBRARY } from "./PathPage";

describe("PathPage (S-04 당신이 고른 길)", () => {
  it("lists the path, then the mood, with no book count", () => {
    const { container } = render(<PathPage summary={{ crumbs: ["뭔가 배우기", "DB에서 꺼내기"], moods: ["바로 따라 해 보기"], mode: "normal" }} notices={[]} />);
    const way = screen.getByRole("region", { name: "지나온 길" });
    expect([...way.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["뭔가 배우기", "DB에서 꺼내기"]);
    expect(screen.getByRole("region", { name: "기분" })).toHaveTextContent("바로 따라 해 보기");
    expect(container).not.toHaveTextContent(/권/);
    expect(screen.queryByText(CHALLENGE_LINE)).toBeNull();
  });

  it("says so on the challenge route", () => {
    render(<PathPage summary={{ crumbs: ["여기 없는 딴 세상"], moods: [], mode: "challenge" }} notices={[]} />);
    expect(screen.getByText("평소의 당신과 반대편에서 골랐어요")).toBeInTheDocument();
  });

  it("names the whole library and a mood left to Galpi when nothing was narrowed or chosen", () => {
    render(<PathPage summary={{ crumbs: [], moods: [], mode: "normal" }} notices={[]} />);
    expect(screen.getByText(WHOLE_LIBRARY)).toBeInTheDocument();
    expect(screen.getByText(MOOD_ANY)).toBeInTheDocument();
  });

  it("shows only the notes while the draw is on its way", () => {
    render(<PathPage summary={null} notices={["조건에 딱 맞는 책은 여기까지예요"]} />);
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("조건에 딱 맞는 책은 여기까지예요");
  });

  it("keeps one live status region on the page, there before any note, so a note that arrives later is announced", () => {
    const { rerender } = render(<PathPage summary={null} notices={[]} />);
    const live = screen.getByRole("status");
    expect(live).toBeEmptyDOMElement();
    rerender(<PathPage summary={{ crumbs: [], moods: [], mode: "normal" }} notices={["첫 번째 메모", "두 번째 메모"]} />);
    expect(screen.getAllByRole("status")).toEqual([live]);
    expect(live).toHaveTextContent("첫 번째 메모두 번째 메모");
  });
});
