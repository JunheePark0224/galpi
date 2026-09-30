import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FORM } from "@/lib/flow/target";
import { track } from "@/lib/track/client";
import { MISSING_WHAT, TargetInput } from "./TargetInput";

vi.mock("@/lib/track/client", () => ({ track: vi.fn() }));

const submit = () => fireEvent.click(screen.getByRole("button", { name: "책 펼치기" }));

describe("TargetInput (S-02 🎯)", () => {
  afterEach(() => vi.clearAllMocks());

  it("stops with a notice when 무엇을 is empty", () => {
    const onSubmit = vi.fn();
    render(<TargetInput initial={EMPTY_FORM} edit={false} onSubmit={onSubmit} />);
    submit();
    expect(screen.getByRole("alert")).toHaveTextContent(MISSING_WHAT);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends a chosen topic with the optional chips and logs every chip", () => {
    const onSubmit = vi.fn();
    render(<TargetInput initial={EMPTY_FORM} edit={false} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "AI 똑똑하게 쓰기" }));
    fireEvent.click(screen.getByRole("button", { name: "얇게" }));
    fireEvent.click(screen.getByRole("button", { name: "사례로 술술" }));
    submit();
    expect(onSubmit).toHaveBeenCalledWith({ topic: "AI 활용", free: null, len: "thin", way: "사례" });
    expect(vi.mocked(track).mock.calls).toEqual([
      ["chip_selected", { question: "topic", value: "AI 활용", edit: false }],
      ["chip_selected", { question: "len", value: "thin", edit: false }],
      ["chip_selected", { question: "way", value: "사례", edit: false }],
    ]);
  });

  it("turns an optional chip off when tapped again", () => {
    render(<TargetInput initial={EMPTY_FORM} edit={false} onSubmit={vi.fn()} />);
    const thin = screen.getByRole("button", { name: "얇게" });
    fireEvent.click(thin);
    fireEvent.click(thin);
    expect(thin).toHaveAttribute("aria-pressed", "false");
    expect(track).toHaveBeenLastCalledWith("chip_selected", { question: "len", value: null, edit: false });
  });

  it("takes a written goal instead of a topic, trimmed", () => {
    const onSubmit = vi.fn();
    render(<TargetInput initial={{ ...EMPTY_FORM, topic: "통계" }} edit={false} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "직접 쓰기" }));
    const box = screen.getByRole("textbox", { name: "직접 쓰기" });
    expect(box).toHaveAttribute("maxLength", "30");
    expect(box).toHaveAttribute("placeholder", "SQL, 엑셀 함수, 번아웃, 발표 준비 …");
    fireEvent.change(box, { target: { value: "  SQL 공부  " } });
    submit();
    expect(onSubmit).toHaveBeenCalledWith({ topic: null, free: "SQL 공부", len: null, way: null });
  });

  it("counts an empty written goal as missing", () => {
    const onSubmit = vi.fn();
    render(<TargetInput initial={EMPTY_FORM} edit={false} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: "직접 쓰기" }));
    submit();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the YES24 search hint and the privacy line under the written goal", () => {
    render(<TargetInput initial={{ ...EMPTY_FORM, free: "" }} edit={false} onSubmit={vi.fn()} />);
    const link = screen.getByRole("link", { name: /예스24 검색을 이용해 주세요/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText(/주제나 고민을 적어 주세요/)).toBeInTheDocument();
    expect(screen.getByText("이름·연락처는 적지 마세요")).toBeInTheDocument();
  });

  it("links the privacy policy in the same tab next to the no-contact-info notice", () => {
    render(<TargetInput initial={{ ...EMPTY_FORM, free: "" }} edit={false} onSubmit={vi.fn()} />);
    const link = screen.getByRole("link", { name: "처리방침" });
    expect(link).toHaveAttribute("href", "/privacy");
    expect(link).not.toHaveAttribute("target");
  });

  it("starts from the previous answers when editing", () => {
    render(<TargetInput initial={{ topic: "통계", free: null, len: "thick", way: "개념" }} edit onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "통계" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "두꺼워도 좋아요" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "보통" }));
    expect(track).toHaveBeenCalledWith("chip_selected", { question: "len", value: "normal", edit: true });
  });
});
