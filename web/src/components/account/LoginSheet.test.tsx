import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
const startLogin = vi.fn();
vi.mock("@/lib/track/client", () => ({ track: (...a: unknown[]) => track(...a) }));
vi.mock("@/lib/auth/browser", () => ({ startLogin: (...a: unknown[]) => startLogin(...a) }));
import { closeLoginSheet, openLoginSheet } from "@/lib/account/store";
import { LoginSheet, LOGIN_BENEFITS } from "./LoginSheet";

describe("LoginSheet (S-07, C-12)", () => {
  beforeEach(() => { startLogin.mockResolvedValue(true); window.history.replaceState(null, "", "/?y=2"); });
  afterEach(() => { act(() => closeLoginSheet()); vi.clearAllMocks(); });

  it("is closed until something opens it", () => {
    render(<LoginSheet />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens from 저장 (a browser that keeps nothing) with its own title, Kakao above Google, a privacy link, and sends E-12 once", () => {
    render(<LoginSheet />);
    act(() => openLoginSheet("save"));
    const dialog = screen.getByRole("dialog", { name: "저장한 책갈피는 내 책갈피에 이렇게 모여요" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["카카오로 계속하기", "Google로 계속하기", "닫기"]);
    expect(screen.getByRole("link", { name: "개인정보 처리방침" })).toHaveAttribute("href", "/privacy");
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("login_prompt_shown", { source: "save" });
    expect(document.activeElement).toBe(buttons[0]);
    // 10-02: the payoff first — an example 내 책갈피 (decorative) and three lines, the privacy note below the buttons
    expect(within(dialog).getAllByRole("listitem").map((li) => li.textContent)).toEqual([...LOGIN_BENEFITS]);
    expect(within(dialog).getByText("읽기 완료!")).toBeInTheDocument();
    expect(screen.getByText(/갈피는 이름·연락처를 쓰지 않아요/)).toBeInTheDocument();
  });

  it("from the header it invites to collect, and says what is not kept", () => {
    render(<LoginSheet />);
    act(() => openLoginSheet("header"));
    expect(screen.getByRole("dialog", { name: "로그인하고 내 책갈피를 모아 보세요" })).toBeInTheDocument();
    expect(screen.getByText(/갈피는 이름·연락처를 쓰지 않아요/)).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith("login_prompt_shown", { source: "header" });
  });

  it("from S-09's [로그인하고 지키기] it says the bookmarks will be kept safe (E-12 library, v1.7)", () => {
    render(<LoginSheet />);
    act(() => openLoginSheet("library"));
    expect(screen.getByRole("dialog", { name: "로그인하고 내 책갈피를 지켜요" })).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith("login_prompt_shown", { source: "library" });
  });

  it("sends E-13 then leaves for the provider, coming back to this very page", async () => {
    render(<LoginSheet />);
    act(() => openLoginSheet("save"));
    fireEvent.click(screen.getByRole("button", { name: "카카오로 계속하기" }));
    expect(track).toHaveBeenLastCalledWith("login_started", { provider: "kakao" });
    await waitFor(() => expect(startLogin).toHaveBeenCalledWith("kakao", "/?y=2"));
  });

  it("says so when the login could not start, and lets the person try again", async () => {
    startLogin.mockResolvedValue(false);
    render(<LoginSheet />);
    act(() => openLoginSheet("header"));
    fireEvent.click(screen.getByRole("button", { name: "Google로 계속하기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("로그인을 시작하지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    expect(screen.getByRole("button", { name: "Google로 계속하기" })).toBeEnabled();
  });

  it("closes with [닫기], Escape and a tap outside, and gives focus back", () => {
    render(<><button type="button">opener</button><LoginSheet /></>);
    const opener = screen.getByRole("button", { name: "opener" });
    opener.focus();
    act(() => openLoginSheet("header"));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
    act(() => openLoginSheet("header"));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => openLoginSheet("header"));
    fireEvent.click(screen.getByTestId("sheet-backdrop"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps Tab inside the sheet", () => {
    render(<LoginSheet />);
    act(() => openLoginSheet("header"));
    const [kakao] = screen.getAllByRole("button");
    const privacy = screen.getByRole("link", { name: "개인정보 처리방침" });
    const close = screen.getByRole("button", { name: "닫기" });
    close.focus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
    expect(document.activeElement).toBe(kakao);
    kakao.focus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(close);
    expect(privacy).toBeInTheDocument();
  });
});
