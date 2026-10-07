import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtCombo } from "@/lib/art/combine";
import type { BookCard } from "@/lib/books/types";
import { SHARED_TITLE, START_MINE, SharedBack } from "./SharedBack";

const track = vi.fn();
vi.mock("@/lib/track/client", () => ({ track: (...a: unknown[]) => track(...a) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const card = (id: string): BookCard => ({
  id, entry: "leaf", title: `책 ${id}`, author: "작가", genre: "에세이", field: null, oneLiner: "한 줄?", oneLinerStyle: "question",
});
const ART: ArtCombo = { animal: "cat", bg: "peach", ground: "grass", rare: false };
const props = () => ({ cards: [card("a"), card("b")], arts: [ART, ART], label: { chips: ["따뜻한 이야기"], challenge: false } });

describe("SharedBack (S-12, F-27)", () => {
  beforeEach(() => { track.mockClear(); });

  it("a visitor sees someone's back cover and [나도 갈피 잡기], and counts as a visit (E-43)", () => {
    render(<SharedBack {...props()} />);
    expect(screen.getByRole("heading", { level: 1, name: SHARED_TITLE })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: START_MINE })).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith("share_page_viewed", { label_count: 1 });
  });

});
