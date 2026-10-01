import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlowRoot } from "./FlowRoot";

const LINE = "갈피의 서재 700권 · 오늘 3권이 새로 꽂혔어요";

describe("FlowRoot passes the F-23 count to S-01", () => {
  it("in the server HTML", () => {
    expect(renderToString(<FlowRoot vocab={{}} library={{ total: 700, today: 3 }} />)).toContain(LINE);
  });

  it("in the browser flow", () => {
    sessionStorage.clear();
    render(<FlowRoot vocab={{}} library={{ total: 700, today: 3 }} />);
    expect(screen.getByText(LINE)).toBeInTheDocument();
  });
});
