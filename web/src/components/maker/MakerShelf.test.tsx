import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
vi.mock("@/lib/track/client", () => ({ track: (...a: unknown[]) => track(...a) }));
import { MakerShelf, MAKER_TITLE } from "./MakerShelf";

const ART = { animal: "rabbit", bg: "aurora", ground: "grass", rare: true };
const card = (id: string, title: string) =>
  ({ id, entry: "leaf", title, author: "김지혜", genre: "사회·시사", field: null, oneLiner: "한 줄 소개예요", oneLinerStyle: "summary" });
const VIEW = {
  shelves: [
    { name: "첫 막대", bookmarks: [{ art: ART, metOn: "2026-10-17", card: card("9788936477196", "선량한 차별주의자") }] },
    { name: "다음에 읽을 책", bookmarks: [{ art: { ...ART, bg: "peach", rare: false }, metOn: "2026-10-12", card: card("9788998441012", "모순") }] },
  ],
  count: 2,
};
const fetchMock = vi.fn<typeof fetch>();
const answer = (body: unknown, status = 200) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
const button = () => screen.getByRole("button", { name: "책갈피 구경 — 갈피를 만든 사람의 책갈피함" });
const sheet = () => screen.getByRole("dialog", { name: MAKER_TITLE });

describe("MakerShelf (S-01 → S-13, PRD F-30, DESIGN C-35)", () => {
  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("is one quiet button with its drawing hidden from screen readers, and asks nothing until pressed", () => {
    const { container } = render(<MakerShelf onStart={() => {}} />);
    expect(button()).toHaveTextContent("책갈피 구경");
    expect(button()).toHaveTextContent("갈피를 만든 사람의 책갈피함");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens the sheet, tracks E-48, and hangs every rod with its bookmarks — to look at only", async () => {
    answer(VIEW);
    render(<MakerShelf onStart={() => {}} />);
    fireEvent.click(button());
    expect(track).toHaveBeenCalledWith("maker_shelf_opened", {});
    expect(fetchMock.mock.calls[0][0]).toBe("/api/maker-shelf");
    await screen.findByRole("button", { name: "선량한 차별주의자 책갈피" });
    const s = within(sheet());
    expect(s.getByText("첫 막대")).toBeInTheDocument();
    expect(s.getByText("다음에 읽을 책")).toBeInTheDocument();
    expect(s.getByText(/갈피를 만든 사람이 직접 뽑아 모은 책갈피예요 · 2권/)).toBeInTheDocument();
    expect(s.queryByRole("button", { name: "막대 이름 고치기" })).toBeNull();
    expect(s.queryByRole("button", { name: /막대 지우기/ })).toBeNull();
  });

  it("shows one bookmark large with its met day, tracks E-49, links to YES24 with source maker_shelf, and goes back", async () => {
    answer(VIEW);
    render(<MakerShelf onStart={() => {}} />);
    fireEvent.click(button());
    fireEvent.click(await screen.findByRole("button", { name: "선량한 차별주의자 책갈피" }));
    expect(track).toHaveBeenCalledWith("maker_bookmark_viewed", { book_id: "9788936477196" });
    const s = within(sheet());
    expect(s.getAllByText("2026. 10. 17. 만남").length).toBeGreaterThan(0);
    const yes24 = s.getByRole("link", { name: /예스24에서 보기/ });
    expect(yes24).toHaveAttribute("href", expect.stringContaining("9788936477196"));
    fireEvent.click(yes24);
    expect(track).toHaveBeenCalledWith("yes24_link_clicked", { book_id: "9788936477196", source: "maker_shelf", pick_type: null });
    expect(s.queryByRole("button", { name: /꾸미기|옮기기|빼기/ })).toBeNull();
    fireEvent.click(s.getByRole("button", { name: "← 책갈피함으로" }));
    expect(await screen.findByRole("button", { name: "모순 책갈피" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("[나도 책갈피 모으러 가기] closes the sheet and starts a round", async () => {
    answer(VIEW);
    const onStart = vi.fn();
    render(<MakerShelf onStart={onStart} />);
    fireEvent.click(button());
    fireEvent.click(await screen.findByRole("button", { name: "모순 책갈피" }));
    fireEvent.click(within(sheet()).getByRole("button", { name: "나도 책갈피 모으러 가기" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says so quietly when the shelf is empty, when it cannot load, and when the answer is not a shelf", async () => {
    for (const [respond, words] of [
      [() => answer({ shelves: [], count: 0 }), "아직 꽂힌 책갈피가 없어요"],
      [() => answer({ error: "unavailable" }, 503), "지금은 책갈피함을 불러올 수 없어요"],
      [() => fetchMock.mockRejectedValueOnce(new TypeError("offline")), "지금은 책갈피함을 불러올 수 없어요"],
      [() => answer({ shelves: "nope" }), "지금은 책갈피함을 불러올 수 없어요"],
    ] as const) {
      respond();
      const view = render(<MakerShelf onStart={() => {}} />);
      fireEvent.click(button());
      await waitFor(() => expect(within(sheet()).getByText(words)).toBeInTheDocument());
      view.unmount();
    }
  });
});
