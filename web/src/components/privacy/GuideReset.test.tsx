import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FIRST_GUIDE_KEY, firstGuide, libraryGuide, RESULT_GUIDE_KEY, resultGuide } from "@/lib/flow/firstGuide";
import { GUIDE_AGAIN, GUIDE_AGAIN_DONE, GuideReset } from "./GuideReset";

describe("GuideReset (C-20 · C-21 on S-10)", () => {
  afterEach(() => { window.localStorage.clear(); firstGuide.forgetForTests(); resultGuide.forgetForTests(); libraryGuide.forgetForTests(); });

  it("forgets that both guides (S-05 first bookmark, S-06 first book) were seen, and says so", () => {
    firstGuide.markSeen();
    resultGuide.markSeen();
    libraryGuide.markSeen();
    expect(window.localStorage.getItem(FIRST_GUIDE_KEY)).toBe("1");
    expect(window.localStorage.getItem(RESULT_GUIDE_KEY)).toBe("1");
    render(<GuideReset />);
    fireEvent.click(screen.getByRole("button", { name: GUIDE_AGAIN }));
    expect(firstGuide.hasSeen()).toBe(false);
    expect(resultGuide.hasSeen()).toBe(false);
    expect(libraryGuide.hasSeen()).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent(GUIDE_AGAIN_DONE);
  });
});
