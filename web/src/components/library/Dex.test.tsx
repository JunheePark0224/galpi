import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
const request = vi.fn();
vi.mock("@/lib/track/client", () => ({ track: (...a: unknown[]) => track(...a) }));
vi.mock("@/lib/library/client", () => ({ libraryRequest: (...a: unknown[]) => request(...a) }));
vi.mock("@/lib/track/amplitude", () => ({ setAmplitudeUser: vi.fn() }));

import { Dex, ODDS_NOTE } from "./Dex";

const art = (animal: string, bg = "peach", ground = "none") => ({ animal, bg, ground, rare: animal !== "cat" });
const row = (kind: string, value: string, a: ReturnType<typeof art>, isNew = false) => ({ kind, value, firstMetAt: "2026-10-05T00:00:00Z", firstArt: a, isNew });
const ok = (body: unknown) => ({ ok: true, status: 200, body });

async function show(answer: unknown) {
  request.mockImplementation(async (_method: string, path: string) => (path === "/api/collection" ? answer : ok({ ok: true, seen: 1 })));
  await act(async () => { render(<Dex />); });
}

describe("도감 (S-09 [도감])", () => {
  beforeEach(() => request.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("counts, tier sections, met cells with their first picture, NEW once, silhouettes with ??? — and E-37", async () => {
    const tiger = art("whitetiger", "night");
    await show(ok({ items: [row("animal", "cat", art("cat")), row("animal", "whitetiger", tiger, true), row("bg", "peach", art("cat"))] }));
    expect(screen.getByText("동물 2 / 16 · 배경 1 / 12 · 소품 0 / 6")).toBeInTheDocument();
    const common = screen.getByRole("region", { name: "동물 일반판" });
    expect(within(common).getByText("1 / 7")).toBeInTheDocument();
    expect(within(common).getByText("고양이")).toBeInTheDocument();
    expect(within(common).getAllByText("아직 만나지 않은 동물")).toHaveLength(6);
    expect(within(common).getAllByText("???")).toHaveLength(6);
    const first = screen.getByRole("region", { name: "동물 초판본" });
    expect(within(first).getByRole("heading", { name: /초판본/ })).toHaveAttribute("data-tier", "first_edition");
    expect(within(first).getByText("백호")).toBeInTheDocument();
    expect(within(first).getByText("NEW")).toBeInTheDocument();
    expect(first.querySelector("svg[data-tier='first_edition']")).not.toBeNull();            // the picture it was met in
    expect(screen.getByText(ODDS_NOTE)).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith("collection_viewed", { collected_count: 3, is_logged_in: true });
    await waitFor(() => expect(request).toHaveBeenCalledWith("POST", "/api/collection/seen"));
  });

  it("switches tabs with pressed buttons; props are the ground props only (10-07 A)", async () => {
    await show(ok({ items: [row("ground", "clover", art("cat", "peach", "clover"))] }));
    const props = screen.getByRole("button", { name: "소품" });
    expect(props).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(props);
    expect(props).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "동물" })).toHaveAttribute("aria-pressed", "false");
    expect(within(screen.getByRole("region", { name: "소품 한정판" })).getByText("네잎클로버")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "소품 한정판" })).getByText("1 / 1")).toBeInTheDocument();
    expect(screen.getAllByText("아직 만나지 않은 소품")).toHaveLength(5);
    expect(screen.queryByText("무지개")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "배경" }));
    expect(screen.getAllByText("아직 만나지 않은 배경")).toHaveLength(12);
    expect(within(screen.getByRole("region", { name: "배경 한정판" })).getByText("0 / 4")).toBeInTheDocument();   // 여름밤 joined
    expect(request).not.toHaveBeenCalledWith("POST", "/api/collection/seen");             // nothing NEW: nothing to clear
  });

  it("draws each met cell's own part: the animal alone, a background alone, a prop alone — no background behind animals and props (10-05 fix, 10-07)", async () => {
    const first = art("cat", "galaxy", "goldbook");
    await show(ok({ items: [
      row("animal", "cat", first), row("bg", "galaxy", first), row("ground", "clover", first), row("ground", "goldbook", first),
      row("ground", "none", first, true),                                  // recorded before the fix: ignored
      row("sky", "rainbow", first, true),                                  // a sky prop from before 10-07 A: ignored
    ] }));
    expect(screen.getByText("동물 1 / 16 · 배경 1 / 12 · 소품 2 / 6")).toBeInTheDocument();
    const animal = screen.getByRole("region", { name: "동물 일반판" }).querySelector("svg")!;
    expect(animal.querySelector("image")).toHaveAttribute("href", "/animals/cat.svg");
    expect(animal.querySelector("rect")).toBeNull();                       // no sky (10-07: the animal alone)
    expect(animal.closest("[data-bare]")).not.toBeNull();
    expect(animal).toHaveAttribute("data-tier", "common");                 // the 초판본 background does not make the cat gold
    expect(animal.querySelector("[data-part=rim]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "배경" }));
    const bg = screen.getByRole("region", { name: "배경 초판본" }).querySelector("svg")!;
    expect(bg.querySelector("image")).toBeNull();                          // no animal on a background cell
    expect(bg.closest("[data-bare]")).toBeNull();                          // a background cell is its sky and hill
    expect(bg).toHaveAttribute("data-tier", "first_edition");
    expect(bg.getAttribute("class")).toMatch(/still/);                     // light in the 도감: the living galaxy stands still
    expect(bg.querySelectorAll("path[style*='animation-delay']")).toHaveLength(0);   // no sparkles
    expect(screen.getByRole("region", { name: "배경 일반판" }).querySelectorAll("svg")).toHaveLength(0);   // unmet: plain arch + ?

    fireEvent.click(screen.getByRole("button", { name: "소품" }));
    const sky = screen.getByRole("region", { name: "소품 한정판" }).querySelector("svg")!;
    expect(sky.querySelector("image")).toBeNull();
    expect(sky.querySelector("rect")).toBeNull();                            // no stage behind the prop (10-07)
    expect(sky.querySelector("path[d^='M-5 76']")).toBeNull();
    expect(sky.querySelector("g[transform]")).not.toBeNull();               // centred and enlarged
    const ground = screen.getByRole("region", { name: "소품 초판본" }).querySelectorAll("li")[0].querySelector("svg")!;
    expect(ground.querySelector("image")).toBeNull();
    expect(ground).toHaveAttribute("data-tier", "first_edition");
    expect(screen.queryByText("빈 언덕")).toBeNull();
    expect(screen.queryByText("NEW")).toBeNull();
  });

  it("says it could not load (table missing or offline) and retries; no E-37", async () => {
    await show({ ok: false, status: 503, body: { error: "collection is not ready" } });
    expect(screen.getByRole("alert")).toHaveTextContent("도감을 불러오지 못했어요.");
    expect(track).not.toHaveBeenCalled();
    request.mockImplementation(async () => ok({ items: [] }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" })); });
    expect(screen.getByText("동물 0 / 16 · 배경 0 / 12 · 소품 0 / 6")).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith("collection_viewed", { collected_count: 0, is_logged_in: true });
  });

  it("asks for a login again when the session ran out", async () => {
    await show({ ok: false, status: 401, body: null });
    expect(screen.getByText("로그인이 끝났어요. 다시 로그인해 주세요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
  });
});
