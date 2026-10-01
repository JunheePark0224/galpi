import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EMPTY_FORM } from "@/lib/flow/target";
import { FirstPage } from "./FirstPage";

const goal = { text: "SQL 공부", topic: "데이터 분석" as const, keywords: ["SQL"], matched: true, missing: null, method: "word" as const };

describe("FirstPage (S-04) and Session Replay", () => {
  it("masks the page in replays when it shows a written goal (taxonomy 6-2: goal_text never reaches Amplitude)", () => {
    const { container } = render(<FirstPage entry="target" choices={[]} form={{ ...EMPTY_FORM, free: "SQL 공부" }} goal={goal} notices={[]} />);
    expect(screen.getByText("“SQL 공부”")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("data-amp-mask");
  });

  it("leaves chosen chips visible in replays (they are our own words)", () => {
    const { container } = render(<FirstPage entry="target" choices={[]} form={{ ...EMPTY_FORM, topic: "통계" }} goal={null} notices={[]} />);
    expect(container.firstElementChild).not.toHaveAttribute("data-amp-mask");
  });
});
