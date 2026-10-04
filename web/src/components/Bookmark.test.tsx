import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import { Bookmark } from "./Bookmark";

const leaf: BookCard = {
  id: "9790000000008", entry: "leaf", title: "천천히 걷는 아침", author: "천아침", genre: "에세이", field: null,
  oneLiner: "오늘 아침은 몇 걸음이었을까요?", oneLinerStyle: "question",
};
const target: BookCard = {
  id: "9790000000101", entry: "target", title: "처음 만나는 쿼리", author: "김쿼리", genre: "데이터 분석", field: "데이터·통계",
  oneLiner: "표에서 원하는 줄만 꺼내는 쿼리를 익혀요", oneLinerStyle: "summary",
};
const art: ArtCombo = { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false };

describe("Bookmark", () => {
  it("reads title, author, one-liner and genre as one label", () => {
    render(<Bookmark card={leaf} art={art} />);
    expect(screen.getByRole("article", { name: "천천히 걷는 아침, 천아침, 오늘 아침은 몇 걸음이었을까요?, 에세이" })).toBeInTheDocument();
  });

  it("writes the title inside 『 』", () => {
    render(<Bookmark card={leaf} art={art} />);
    expect(screen.getByText("『천천히 걷는 아침』").tagName).toBe("H3");
  });

  it("shows the author small, right under the title (PRD F-08)", () => {
    render(<Bookmark card={leaf} art={art} />);
    const title = screen.getByText("『천천히 걷는 아침』");
    expect(title.nextElementSibling).toHaveTextContent("천아침");
  });

  it("leaves the author out when a flow saved before the author field has none", () => {
    const old = { ...leaf, author: undefined } as unknown as BookCard;   // sessionStorage from before the deploy
    const { container } = render(<Bookmark card={old} art={art} />);
    expect(screen.getByRole("article", { name: "천천히 걷는 아침, 오늘 아침은 몇 걸음이었을까요?, 에세이" })).toBeInTheDocument();
    expect(container.textContent).not.toContain("undefined");
    expect(screen.getByText("『천천히 걷는 아침』").nextElementSibling).toHaveTextContent("오늘 아침은 몇 걸음이었을까요?");
  });

  it("treats an empty author the same way", () => {
    render(<Bookmark card={{ ...leaf, author: "" }} art={art} />);
    expect(screen.getByRole("article", { name: "천천히 걷는 아침, 오늘 아침은 몇 걸음이었을까요?, 에세이" })).toBeInTheDocument();
  });

  it("draws the chosen animal inside its own arched window", () => {
    const { container } = render(<Bookmark card={leaf} art={art} />);
    expect(container.querySelector("image")?.getAttribute("href")).toBe("/animals/fox.svg");
    expect(container.querySelector('[id="arch-9790000000008"]')).not.toBeNull();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("turns the frost off while it moves", () => {
    render(<Bookmark card={leaf} art={art} moving />);
    expect(screen.getByRole("article")).toHaveAttribute("data-moving");
  });

  it("shows a 🎯 book's topic on its field colour", () => {
    render(<Bookmark card={target} art={art} />);
    expect(screen.getByText("데이터 분석").getAttribute("style")).toContain("var(--field-data)");
  });
});
