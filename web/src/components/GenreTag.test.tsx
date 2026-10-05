import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GenreTag } from "./GenreTag";

describe("GenreTag (C-04)", () => {
  it("shows 로맨스 on its own deep rose with white text (DESIGN T-02, 10-05)", () => {
    render(<GenreTag card={{ entry: "leaf", genre: "로맨스", field: null }} />);
    const tag = screen.getByText("로맨스");
    expect(tag.style.background).toBe("var(--genre-romance)");
    expect(tag.style.color).toBe("rgb(255, 255, 255)");
  });

  it("shows a 10-05 topic by its name on its field's colour", () => {
    render(<GenreTag card={{ entry: "target", genre: "마케팅·브랜딩", field: "일·커리어" }} />);
    expect(screen.getByText("마케팅·브랜딩").style.background).toBe("var(--field-career)");
  });
});
