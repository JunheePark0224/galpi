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

  it("F-24: the 이렇게 이해했어요 block sits right under the 무엇을 row, inside the masked page", () => {
    const { container } = render(<FirstPage entry="target" choices={[]} form={{ ...EMPTY_FORM, free: "SQL 공부" }} goal={goal} coverage="SQL 책은 아직 2권이에요. 나머지는 가까운 '데이터 분석' 책이에요" notices={[]} />);
    const block = screen.getByRole("region", { name: "이렇게 이해했어요" });
    expect(block).toHaveTextContent("데이터·통계 › 데이터 분석 › SQL로 찾았어요SQL 책은 아직 2권이에요.");
    expect(screen.getByText("“SQL 공부”").compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(block.compareDocumentPosition(screen.getByText("분량")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.firstElementChild?.contains(block)).toBe(true);
  });

  it("leaves chosen chips visible in replays (they are our own words)", () => {
    const { container } = render(<FirstPage entry="target" choices={[]} form={{ ...EMPTY_FORM, topic: "통계" }} goal={null} notices={[]} />);
    expect(container.firstElementChild).not.toHaveAttribute("data-amp-mask");
  });
});
