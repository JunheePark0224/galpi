import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TOPICS, type Topic } from "@/lib/books/taxonomy";
import { EMPTY_FORM, type TargetForm } from "@/lib/flow/target";
import { track } from "@/lib/track/client";
import { MISSING_WHAT, TargetInput } from "./TargetInput";

vi.mock("@/lib/track/client", () => ({ track: vi.fn() }));

const submit = () => fireEvent.click(screen.getByRole("button", { name: "책 펼치기" }));
const field = () => screen.getByRole("textbox", { name: "무엇을 알고 싶어요" });
const EXAMPLES = ["돈 관리", "취업 준비", "불안할 때", "데이터 분석", "AI 잘 쓰기", "글 잘 쓰기"];

function show(opts: { initial?: TargetForm; edit?: boolean; busy?: boolean; topics?: readonly Topic[] } = {}) {
  const onSubmit = vi.fn();
  render(<TargetInput initial={opts.initial ?? EMPTY_FORM} edit={opts.edit ?? false} busy={opts.busy} topics={opts.topics ?? TOPICS} onSubmit={onSubmit} />);
  return onSubmit;
}

describe("TargetInput (S-02 🎯, B: field first, example chips under it)", () => {
  afterEach(() => vi.clearAllMocks());

  it("puts the 30-character field first, then the six example chips when every topic is active", () => {
    show();
    expect(field()).toHaveAttribute("maxLength", "30");
    expect(field()).toHaveAttribute("placeholder", "요즘 알고 싶은 걸 적어 주세요 (30자)");
    const examples = screen.getByRole("group", { name: "예시" });
    expect([...examples.querySelectorAll("button")].map((b) => b.textContent)).toEqual(EXAMPLES);
    expect(screen.queryByRole("button", { name: "직접 쓰기" })).toBeNull();
  });

  it("hides example chips whose topic is not active yet", () => {
    show({ topics: ["데이터 분석", "통계", "AI 활용"] });
    const examples = screen.getByRole("group", { name: "예시" });
    expect([...examples.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["데이터 분석", "AI 잘 쓰기"]);
    expect(screen.queryByRole("button", { name: "돈 관리" })).toBeNull();
  });

  it("leaves the example row out when no example topic is active — the field still works", () => {
    const onSubmit = show({ topics: ["통계"] });
    expect(screen.queryByRole("group", { name: "예시" })).toBeNull();
    fireEvent.change(field(), { target: { value: "통계 공부" } });
    submit();
    expect(onSubmit).toHaveBeenCalledWith({ topic: null, free: "통계 공부", len: null, way: null });
  });

  it("fills the field when an example is tapped, marks it, logs it, and sends that text", () => {
    const onSubmit = show();
    fireEvent.click(screen.getByRole("button", { name: "불안할 때" }));
    expect(field()).toHaveValue("불안할 때");
    expect(screen.getByRole("button", { name: "불안할 때" })).toHaveAttribute("aria-pressed", "true");
    expect(track).toHaveBeenCalledWith("chip_selected", { chip_type: "example", chip_value: "불안할 때", is_edit: false });
    submit();
    expect(onSubmit).toHaveBeenCalledWith({ topic: null, free: "불안할 때", len: null, way: null });
  });

  it("lets the visitor edit a filled example — it is then their own words", () => {
    const onSubmit = show();
    fireEvent.click(screen.getByRole("button", { name: "취업 준비" }));
    fireEvent.change(field(), { target: { value: "취업 준비 막막해요" } });
    expect(screen.getByRole("button", { name: "취업 준비" })).toHaveAttribute("aria-pressed", "false");
    submit();
    expect(onSubmit).toHaveBeenCalledWith({ topic: null, free: "취업 준비 막막해요", len: null, way: null });
    expect(vi.mocked(track).mock.calls).toEqual([["chip_selected", { chip_type: "example", chip_value: "취업 준비", is_edit: false }]]);
  });

  it("replaces whatever was in the field with the tapped example", () => {
    show({ initial: { ...EMPTY_FORM, free: "SQL" } });
    fireEvent.click(screen.getByRole("button", { name: "AI 잘 쓰기" }));
    expect(field()).toHaveValue("AI 잘 쓰기");
  });

  it("waits while a written goal is being sorted", () => {
    const onSubmit = show({ initial: { ...EMPTY_FORM, free: "SQL" }, busy: true });
    const button = screen.getByRole("button", { name: "책 펼치기" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.submit(button.closest("form") as HTMLFormElement);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("stops with a notice when 무엇을 is empty or only spaces", () => {
    const onSubmit = show();
    submit();
    expect(screen.getByRole("alert")).toHaveTextContent(MISSING_WHAT);
    fireEvent.change(field(), { target: { value: "   " } });
    expect(screen.queryByRole("alert")).toBeNull();
    submit();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends the trimmed text with the optional chips and logs every chip", () => {
    const onSubmit = show({ initial: { ...EMPTY_FORM, topic: "통계" } });
    fireEvent.change(field(), { target: { value: "  SQL 공부  " } });
    fireEvent.click(screen.getByRole("button", { name: "얇게" }));
    fireEvent.click(screen.getByRole("button", { name: "사례로 술술" }));
    submit();
    expect(onSubmit).toHaveBeenCalledWith({ topic: null, free: "SQL 공부", len: "thin", way: "사례" });
    expect(vi.mocked(track).mock.calls).toEqual([
      ["chip_selected", { chip_type: "len", chip_value: "thin", is_edit: false }],
      ["chip_selected", { chip_type: "way", chip_value: "사례", is_edit: false }],
    ]);
  });

  it("submits on Enter and keeps the text on one line", () => {
    const onSubmit = show();
    fireEvent.change(field(), { target: { value: "번아웃\n와요" } });
    expect(field()).toHaveValue("번아웃 와요");
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith({ topic: null, free: "번아웃 와요", len: null, way: null });
  });

  it("does not submit on Enter while a Korean syllable is still being composed", () => {
    const onSubmit = show({ initial: { ...EMPTY_FORM, free: "번아웃" } });
    fireEvent.keyDown(field(), { key: "Enter", isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit on the IME Enter some browsers send after composition ends (keyCode 229)", () => {
    const onSubmit = show({ initial: { ...EMPTY_FORM, free: "번아웃" } });
    fireEvent.keyDown(field(), { key: "Enter", keyCode: 229 });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("while sorting, ignores Enter and holds every chip so no chip_selected fires mid-classify", () => {
    const onSubmit = show({ initial: { ...EMPTY_FORM, free: "SQL" }, busy: true });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
    for (const name of ["데이터 분석", "얇게", "사례로 술술"]) {
      const chip = screen.getByRole("button", { name });
      expect(chip).toBeDisabled();
      fireEvent.click(chip);
    }
    expect(field()).toHaveValue("SQL");
    expect(track).not.toHaveBeenCalled();
  });

  it("marks the example that matches the text even with spaces at the ends (as the submit does)", () => {
    show({ initial: { ...EMPTY_FORM, free: " 글 잘 쓰기 " } });
    expect(screen.getByRole("button", { name: "글 잘 쓰기" })).toHaveAttribute("aria-pressed", "true");
  });

  it("turns an optional chip off when tapped again", () => {
    show();
    const thin = screen.getByRole("button", { name: "얇게" });
    fireEvent.click(thin);
    fireEvent.click(thin);
    expect(thin).toHaveAttribute("aria-pressed", "false");
    expect(track).toHaveBeenLastCalledWith("chip_selected", { chip_type: "len", chip_value: null, is_edit: false });
  });

  it("shows the YES24 search hint and the privacy line under the field", () => {
    show();
    const link = screen.getByRole("link", { name: /예스24 검색을 이용해 주세요/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText(/주제나 고민을 적어 주세요/)).toBeInTheDocument();
    expect(screen.getByText("이름·연락처는 적지 마세요")).toBeInTheDocument();
  });

  it("links the privacy policy in the same tab next to the no-contact-info notice", () => {
    show();
    const link = screen.getByRole("link", { name: "처리방침" });
    expect(link).toHaveAttribute("href", "/privacy");
    expect(link).not.toHaveAttribute("target");
  });

  it("starts from the previous answers when editing", () => {
    show({ initial: { topic: null, free: "SQL 공부", len: "thick", way: "개념" }, edit: true });
    expect(field()).toHaveValue("SQL 공부");
    expect(screen.getByRole("button", { name: "두꺼워도 좋아요" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "보통" }));
    expect(track).toHaveBeenCalledWith("chip_selected", { chip_type: "len", chip_value: "normal", is_edit: true });
  });

  it("asks again for 무엇을 when resuming a form saved before B (a topic, no text)", () => {
    const onSubmit = show({ initial: { topic: "통계", free: null, len: null, way: null }, edit: true });
    expect(field()).toHaveValue("");
    submit();
    expect(screen.getByRole("alert")).toHaveTextContent(MISSING_WHAT);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("masks the field in Session Replay whatever the dashboard's mask level is (taxonomy 6-2)", () => {
    show();
    expect(field()).toHaveAttribute("data-amp-mask");
  });
});
