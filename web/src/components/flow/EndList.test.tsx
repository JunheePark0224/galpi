import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PickView } from "@/lib/flow/state";
import { EndList } from "./EndList";

const pick = (id: string): PickView => ({
  card: { id, entry: "leaf", title: `책 ${id}`, author: `저자 ${id}`, genre: "에세이", field: null, oneLiner: `한 줄 ${id}`, oneLinerStyle: "question" },
  kind: "recommended",
  art: { animal: "cat", bg: "peach", sky: "moon", ground: "none", rare: false },
});

describe("EndList", () => {
  it("lists only the curious books and goes home", () => {
    const onHome = vi.fn();
    render(<EndList picks={[pick("a"), pick("b"), pick("c")]} reactions={["curious", "pass", "curious"]} onHome={onHome} />);
    expect(screen.getByRole("heading", { name: "궁금해요 책" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["에세이책 a저자 a한 줄 a", "에세이책 c저자 c한 줄 c"]);
    fireEvent.click(screen.getByRole("button", { name: "처음으로" }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("shows only 처음으로 when nothing was curious", () => {
    render(<EndList picks={[pick("a")]} reactions={["pass"]} onHome={vi.fn()} />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByRole("button", { name: "처음으로" })).toBeInTheDocument();
  });
});
