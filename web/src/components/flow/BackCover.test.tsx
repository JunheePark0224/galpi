import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import { NO_CHIP_LINE } from "@/lib/share/label";
import { BackActions, BackLaid, CHALLENGE_CHIP, LABEL_TITLE, NEXT_WHEN_NONE, SHARE, type ShareMethod } from "./BackCover";
import type { ShareLabel } from "@/lib/share/label";

const card = (id: string): BookCard => ({
  id, entry: "leaf", title: `책 ${id}`, author: "작가", genre: "에세이", field: null, oneLiner: "한 줄?", oneLinerStyle: "question",
});
const ART: ArtCombo = { animal: "cat", bg: "peach", ground: "grass", rare: false };
const BOOKS = ["a", "b", "c", "d", "e"].map((id) => ({ card: card(id), art: ART }));
const URL_ = "https://www.galpibook.com/s/1~0A~a.b~000000";
interface Props {
  books: typeof BOOKS; label: ShareLabel; curious: number; shareUrl: string; onContinue: () => void; onShared: (m: ShareMethod) => void;
}
/** S-11 as BookScene shows it once the book has shut: what lies on the back, and the buttons under the book. */
function BackCover({ books, label, curious, shareUrl, onContinue, onShared }: Props) {
  return (
    <>
      <BackLaid books={books} label={label} />
      <BackActions count={books.length} curious={curious} shareUrl={shareUrl} onContinue={onContinue} onShared={onShared} />
    </>
  );
}
const props = (over: Partial<Props> = {}): Props => ({
  books: BOOKS, label: { chips: ["읽는 시간 자체를 즐기기", "몽글몽글 따뜻함"], challenge: false }, curious: 2,
  shareUrl: URL_, onContinue: vi.fn(), onShared: vi.fn(), ...over,
});

describe("BackLaid + BackActions (S-11, F-27 — the back of the book with today's five bookmarks)", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("lays the five bookmarks on the back cover with the 내가 고른 길 label, and continues to the 궁금해요 books", () => {
    const p = props();
    const { container } = render(<BackCover {...p} />);
    expect(container.querySelectorAll("article")).toHaveLength(5);                     // the real bookmarks, small
    const label = screen.getByRole("group", { name: LABEL_TITLE });
    expect(within(label).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["읽는 시간 자체를 즐기기", "몽글몽글 따뜻함"]);
    const main = screen.getByRole("button", { name: "궁금해요 2권 책 정보 보기" });
    expect(main).toHaveAttribute("data-variant", "primary");
    fireEvent.click(main);
    expect(p.onContinue).toHaveBeenCalledTimes(1);
  });

  it("puts the challenge first, says 기분 따라 골랐어요 when no choice holds, and moves on to S-08 with no 궁금해요", () => {
    render(<BackCover {...props({ label: { chips: ["따뜻한 이야기"], challenge: true }, curious: 0 })} />);
    expect(within(screen.getByRole("group", { name: LABEL_TITLE })).getAllByRole("listitem").map((li) => li.textContent))
      .toEqual([CHALLENGE_CHIP, "따뜻한 이야기"]);
    expect(screen.getByRole("button", { name: NEXT_WHEN_NONE })).toBeInTheDocument();
    render(<BackCover {...props({ label: { chips: [], challenge: false } })} />);
    expect(screen.getByText(NO_CHIP_LINE)).toBeInTheDocument();
  });

  it("[↗ 결과 공유하기] opens the share sheet (C-31) and 닫기 closes it", () => {
    vi.stubGlobal("navigator", { ...navigator, userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0", canShare: undefined });
    render(<BackCover {...props()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: SHARE }));
    expect(screen.getByRole("dialog", { name: "결과 공유하기" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: SHARE })).toHaveFocus();   // focus back where it was
  });
});
