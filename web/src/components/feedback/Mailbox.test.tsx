import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendFeedback = vi.fn();
vi.mock("@/lib/feedback/send", () => ({ sendFeedback: (...a: unknown[]) => sendFeedback(...a) }));
import { Mailbox } from "./Mailbox";

const LETTER = "처음 화면이 예뻐요";
const open = () => fireEvent.click(screen.getByRole("button", { name: "갈피 우체통 — 써 보고 느낀 점을 넣어 주세요" }));
const field = () => screen.getByLabelText("써 보고 느낀 점") as HTMLTextAreaElement;
const write = (text: string) => fireEvent.change(field(), { target: { value: text } });
const put = () => fireEvent.click(screen.getByRole("button", { name: "넣기" }));

/** Every attribute value on the page — the letter must never be one of them (taxonomy 6-2). */
const attributes = () => [...document.querySelectorAll("*")].flatMap((el) => [...el.attributes].map((a) => a.value)).join(" ");

describe("Mailbox (S-01, PRD F-26, DESIGN C-18)", () => {
  beforeEach(() => sendFeedback.mockResolvedValue(true));
  afterEach(() => vi.clearAllMocks());

  it("is one quiet button with the slot drawing hidden from screen readers", () => {
    const { container } = render(<Mailbox />);
    const button = screen.getByRole("button");
    expect(button).toHaveAccessibleName("갈피 우체통 — 써 보고 느낀 점을 넣어 주세요");
    expect(button).toHaveTextContent("갈피 우체통");
    expect(button).toHaveTextContent("써 보고 느낀 점을 넣어 주세요");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the 갈피 우체통 sheet: the intro, a labelled 500-character field with a counter, the note and one [넣기]", () => {
    render(<Mailbox />);
    open();
    expect(screen.getByRole("dialog", { name: "갈피 우체통" })).toBeInTheDocument();
    expect(screen.getByText("불편했던 곳, 좋았던 책, 한 줄이어도 정말 큰 도움이 돼요.")).toBeInTheDocument();
    expect(field()).toHaveAttribute("maxLength", "500");
    expect(field()).toHaveAttribute("placeholder", "여기에 적어 주세요");
    expect(field().closest("[data-amp-mask]")).not.toBeNull();
    expect(screen.getByText("0 / 500")).toBeInTheDocument();
    expect(screen.getByText("이름·연락처는 적지 마세요. 적은 글은 갈피 저장소에만 보관해요.")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getAllByRole("button").map((b) => b.textContent)).toEqual(["넣기", "닫기"]);
    expect(document.activeElement).toBe(field());
  });

  it("counts the characters as they are written, and never puts the letter in an attribute", () => {
    render(<Mailbox />);
    open();
    write(LETTER);
    expect(screen.getByText(`${LETTER.length} / 500`)).toBeInTheDocument();
    expect(attributes()).not.toContain(LETTER);
  });

  it("does not send an empty or blank letter — it says so in place", () => {
    render(<Mailbox />);
    open();
    put();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("느낀 점을 한 줄이라도 적어 주세요.");
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field().getAttribute("aria-describedby")).toContain(alert.id);
    write("   \n  ");
    put();
    expect(sendFeedback).not.toHaveBeenCalled();
    write(LETTER);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(field()).toHaveAttribute("aria-invalid", "false");
    expect(field().getAttribute("aria-describedby")?.split(" ")).toHaveLength(2);
  });

  it("stays open while the letter is on its way — Escape and a tap outside wait for the answer", async () => {
    let finish: (v: boolean) => void = () => {};
    sendFeedback.mockReturnValue(new Promise<boolean>((resolve) => { finish = resolve; }));
    render(<Mailbox />);
    open();
    write(LETTER);
    put();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByTestId("sheet-backdrop"));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(sendFeedback).toHaveBeenCalledTimes(1);
    await act(async () => finish(true));
    expect(screen.getByTestId("mailbox-thanks")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sends once however often [넣기] is pressed, then thanks — the slot takes the letter", async () => {
    let finish: (v: boolean) => void = () => {};
    sendFeedback.mockReturnValue(new Promise<boolean>((resolve) => { finish = resolve; }));
    render(<Mailbox />);
    open();
    write(LETTER);
    put();
    fireEvent.click(screen.getByRole("button", { name: "넣는 중…" }));
    fireEvent.submit(field().closest("form")!);
    expect(sendFeedback).toHaveBeenCalledTimes(1);
    expect(sendFeedback).toHaveBeenCalledWith(LETTER);
    await act(async () => finish(true));
    const thanks = screen.getByTestId("mailbox-thanks");
    expect(thanks).toHaveTextContent("고마워요, 잘 받았어요하나하나 읽어 볼게요.");
    expect(document.activeElement).toBe(thanks);                 // focus carries the thanks to screen readers
    expect(document.querySelector("svg[data-dropped]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the letter and says so when sending fails, and lets the person try again", async () => {
    sendFeedback.mockResolvedValueOnce(false);
    render(<Mailbox />);
    open();
    write(LETTER);
    put();
    expect(await screen.findByRole("alert")).toHaveTextContent("보내지 못했어요. 잘 안 되면 잠시 뒤에 다시 해 주세요.");
    expect(field().value).toBe(LETTER);
    expect(screen.queryByText("고마워요, 잘 받았어요")).toBeNull();
    put();
    await waitFor(() => expect(screen.getByText("고마워요, 잘 받았어요")).toBeInTheDocument());
    expect(sendFeedback).toHaveBeenCalledTimes(2);
  });

  it("closes with the small [닫기] too — reachable without Escape or the backdrop", () => {
    render(<Mailbox />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes with Escape or a tap outside and starts empty next time", () => {
    render(<Mailbox />);
    open();
    write(LETTER);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    open();
    expect(field().value).toBe("");
    fireEvent.click(screen.getByTestId("sheet-backdrop"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
