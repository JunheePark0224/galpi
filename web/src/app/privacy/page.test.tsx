import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PrivacyPage, { CONTACT_PENDING } from "./page";

describe("/privacy (S-10 v0)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllEnvs());

  it("shows the title, the date and the four collected items", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "개인정보 처리방침" })).toBeInTheDocument();
    expect(screen.getByText(/2026-09-30/)).toBeInTheDocument();
    expect(screen.getByText("갈피는 이름·이메일·전화번호를 받지 않아요.")).toBeInTheDocument();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(5); // header + 4
    expect(screen.getByRole("columnheader", { name: "모으는 것" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "왜" })).toBeInTheDocument();
    expect(screen.getByText("같은 사람이 다시 왔는지 세기 위해")).toBeInTheDocument();
    expect(screen.getByText("추천이 잘 맞는지 분석하기 위해")).toBeInTheDocument();
    expect(screen.getByText("화면이 잘 동작하는지 확인하기 위해")).toBeInTheDocument();
    expect(screen.getByText(/사람들이 찾는 주제를 알고 책을 늘리기 위해/)).toBeInTheDocument();
    expect(screen.getByText("이름·연락처는 적지 마세요")).toBeInTheDocument();
  });

  it("states the one-year retention, the hosts and the no-sharing promise", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("수집일로부터 1년이 지나면 자동으로 지워져요.")).toBeInTheDocument();
    expect(screen.getByText(/Supabase\(데이터베이스 서비스\)에 저장되고/)).toBeInTheDocument();
    expect(screen.getByText(/사이트는 Vercel에서 운영돼요/)).toBeInTheDocument();
    expect(screen.getByText("다른 곳에 주지 않아요.")).toBeInTheDocument();
    expect(screen.getByText(/새로 전달하는 곳이 생기면 이 페이지에 먼저 적어요/)).toBeInTheDocument();
  });

  it("shows the fallback line when no contact email is set", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "");
    render(<PrivacyPage />);
    expect(screen.getByText(CONTACT_PENDING)).toBeInTheDocument();
    expect(CONTACT_PENDING).toBe("문의 이메일은 곧 적어 둘게요");
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it("links the contact email with mailto when it is set", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "hello@example.com");
    render(<PrivacyPage />);
    const link = screen.getByRole("link", { name: "hello@example.com" });
    expect(link).toHaveAttribute("href", "mailto:hello@example.com");
    expect(screen.queryByText(CONTACT_PENDING)).not.toBeInTheDocument();
  });

  it("shows the anonymous id block without creating an id", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("아직 기록이 없어요")).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
  });

  it("ends with the disclaimer and a way back to the start", () => {
    render(<PrivacyPage />);
    expect(screen.getByText("갈피는 예스24와 무관한 개인 포트폴리오 프로젝트예요.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "처음으로" })).toHaveAttribute("href", "/");
  });
});
