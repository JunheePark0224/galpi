import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FIRST_GUIDE_KEY, forgetFirstGuideForTests, hasSeenFirstGuide, markFirstGuideSeen } from "@/lib/flow/firstGuide";
import { GUIDE_AGAIN, GUIDE_AGAIN_DONE, GuideReset } from "./GuideReset";

describe("GuideReset (C-20 on S-10)", () => {
  afterEach(() => { window.localStorage.clear(); forgetFirstGuideForTests(); });

  it("forgets that the first-bookmark guide was seen, and says so", () => {
    markFirstGuideSeen();
    expect(window.localStorage.getItem(FIRST_GUIDE_KEY)).toBe("1");
    render(<GuideReset />);
    fireEvent.click(screen.getByRole("button", { name: GUIDE_AGAIN }));
    expect(hasSeenFirstGuide()).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent(GUIDE_AGAIN_DONE);
  });
});
