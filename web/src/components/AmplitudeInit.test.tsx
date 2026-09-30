import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { startAmplitude } from "@/lib/track/amplitude";
import { AmplitudeInit } from "./AmplitudeInit";

vi.mock("@/lib/track/amplitude", () => ({ startAmplitude: vi.fn() }));
const pathname = vi.fn<() => string>();
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));

describe("AmplitudeInit", () => {
  beforeEach(() => { vi.mocked(startAmplitude).mockReset(); });

  it("starts Amplitude on a normal page and renders nothing", () => {
    pathname.mockReturnValue("/");
    const { container } = render(<AmplitudeInit />);
    expect(startAmplitude).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
  });

  it("stays off on /privacy, which reads the anonymous id but records nothing", () => {
    pathname.mockReturnValue("/privacy");
    render(<AmplitudeInit />);
    expect(startAmplitude).not.toHaveBeenCalled();
  });

  it("starts once the visitor moves from /privacy to another page", () => {
    pathname.mockReturnValue("/privacy");
    const { rerender } = render(<AmplitudeInit />);
    pathname.mockReturnValue("/");
    rerender(<AmplitudeInit />);
    expect(startAmplitude).toHaveBeenCalledTimes(1);
  });
});
