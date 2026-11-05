import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SHELF_NAME_MAX } from "@/lib/library/validate";
import { NameCount } from "./NameCount";

describe("NameCount — how much of a rod name is left (C-17, 11-05)", () => {
  it("shows the count out of the limit while there is room", () => {
    render(<NameCount value="읽을 책" />);
    expect(screen.getByText(`4/${SHELF_NAME_MAX}`)).toBeInTheDocument();
    expect(screen.queryByText(/까지 쓸 수 있어요/)).toBeNull();
  });

  it("counts characters, not UTF-16 units (an emoji is one)", () => {
    render(<NameCount value="🌙 밤" />);
    expect(screen.getByText(`3/${SHELF_NAME_MAX}`)).toBeInTheDocument();
  });

  it("says the limit in words once the name is full, politely to screen readers", () => {
    render(<NameCount value={"가".repeat(SHELF_NAME_MAX)} />);
    const note = screen.getByText(`막대 이름은 ${SHELF_NAME_MAX}자까지 쓸 수 있어요`);
    expect(note.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
    expect(note.closest("[data-full]")).not.toBeNull();
  });
});
