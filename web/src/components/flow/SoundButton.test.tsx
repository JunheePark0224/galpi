import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
vi.mock("@/lib/track/client", () => ({ track: (...a: unknown[]) => track(...a) }));
import { forgetSoundForTests, isSoundOn, SOUND_OFF_KEY } from "@/lib/sound/pageSound";
import { SOUND_LABEL, SoundButton } from "./SoundButton";

describe("SoundButton (PRD F-29, DESIGN C-34)", () => {
  beforeEach(() => { localStorage.clear(); forgetSoundForTests(); });
  afterEach(() => vi.clearAllMocks());

  it("is a pressed toggle named 책장 소리 while the sound is on (the default), its icon hidden from screen readers", () => {
    const { container } = render(<SoundButton />);
    const button = screen.getByRole("button", { name: SOUND_LABEL });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("turns the sound off and on, remembers it, and sends E-47 with the new state", () => {
    render(<SoundButton />);
    const button = screen.getByRole("button", { name: SOUND_LABEL });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(isSoundOn()).toBe(false);
    expect(localStorage.getItem(SOUND_OFF_KEY)).toBe("1");
    expect(track).toHaveBeenLastCalledWith("sound_toggle_clicked", { is_sound_on: false });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(track).toHaveBeenLastCalledWith("sound_toggle_clicked", { is_sound_on: true });
  });

  it("starts off when this browser turned it off before", () => {
    localStorage.setItem(SOUND_OFF_KEY, "1");
    render(<SoundButton />);
    expect(screen.getByRole("button", { name: SOUND_LABEL })).toHaveAttribute("aria-pressed", "false");
  });
});
