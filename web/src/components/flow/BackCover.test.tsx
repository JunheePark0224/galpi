import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import { NO_CHIP_LINE } from "@/lib/share/label";
import { BACK_TITLE, BackCover, CHALLENGE_CHIP, COPIED, LABEL_TITLE, NEXT_WHEN_NONE, SHARE } from "./BackCover";

const card = (id: string): BookCard => ({
  id, entry: "leaf", title: `책 ${id}`, author: "작가", genre: "에세이", field: null, oneLiner: "한 줄?", oneLinerStyle: "question",
});
const ART: ArtCombo = { animal: "cat", bg: "peach", ground: "grass", rare: false };
const BOOKS = ["a", "b", "c", "d", "e"].map((id) => ({ card: card(id), art: ART }));
const URL_ = "https://www.galpibook.com/s/1~0A~a.b~000000";
const props = (over: Partial<Parameters<typeof BackCover>[0]> = {}) => ({
  books: BOOKS, label: { chips: ["읽는 시간 자체를 즐기기", "몽글몽글 따뜻함"], challenge: false }, curious: 2,
  shareUrl: URL_, onContinue: vi.fn(), onShared: vi.fn(), ...over,
});

describe("BackCover (S-11, F-27 — the back of the book with today's five bookmarks)", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("lays the five bookmarks on the back cover with the 내가 고른 길 label, and continues to the 궁금해요 books", () => {
    const p = props();
    const { container } = render(<BackCover {...p} />);
    expect(screen.getByRole("heading", { level: 1, name: BACK_TITLE })).toBeInTheDocument();
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

  it("[공유하기] opens the phone's share sheet with the link when there is one (E-42 native)", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share });
    const p = props();
    render(<BackCover {...p} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: SHARE })); });
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: URL_, title: "갈피" }));
    expect(p.onShared).toHaveBeenCalledWith("native");
  });

  it("does not count a share sheet the person closed", async () => {
    vi.stubGlobal("navigator", { ...navigator, share: vi.fn().mockRejectedValue(new DOMException("closed", "AbortError")) });
    const p = props();
    render(<BackCover {...p} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: SHARE })); });
    expect(p.onShared).not.toHaveBeenCalled();
  });

  it("copies the link where there is no share sheet, says so, and offers the story image to save (E-42 copy · save_image)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });
    const p = props();
    render(<BackCover {...p} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: SHARE })); });
    expect(writeText).toHaveBeenCalledWith(URL_);
    expect(screen.getByRole("status")).toHaveTextContent(COPIED);
    expect(p.onShared).toHaveBeenCalledWith("copy");
    const save = screen.getByRole("link", { name: "이미지 저장" });
    expect(save).toHaveAttribute("href", "/s/1~0A~a.b~000000/story");
    expect(save).toHaveAttribute("download");
    fireEvent.click(save);
    expect(p.onShared).toHaveBeenCalledWith("save_image");
  });
});
