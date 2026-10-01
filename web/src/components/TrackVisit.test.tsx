import { afterEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_VOCAB } from "@/lib/books/catalog";
import type { FlowState } from "@/lib/flow/state";

/**
 * The first visit event of a document must already carry the round and entry that document starts in. The real page is server
 * HTML (S-01) hydrated on the client: TrackVisit's effect runs in the hydration commit, before FlowRoot switches to Flow.
 */
describe("site_visited on a fresh open vs a reload (hydrated TrackVisit + FlowRoot)", () => {
  const midRound = { step: "bookmarks", entry: "leaf", choices: ["A", "B"], seen: ["b1"] } as unknown as FlowState;
  let unmount: (() => void) | null = null;

  afterEach(() => {
    unmount?.();
    unmount = null;
    Reflect.deleteProperty(document, "wasDiscarded");
    Reflect.deleteProperty(navigator, "sendBeacon");
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  async function openWith(navType: string) {
    sessionStorage.setItem("galpi.flow", JSON.stringify({ v: 3, state: { ...midRound, status: "idle", draw: null } }));
    sessionStorage.setItem("galpi.round", "1");
    sessionStorage.setItem("galpi.entry", "leaf");
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([{ type: navType }] as unknown as PerformanceEntryList);
    Object.defineProperty(document, "wasDiscarded", { value: false, configurable: true });
    window.scrollTo = vi.fn();
    const sent: Blob[] = [];
    Object.defineProperty(navigator, "sendBeacon", {   // jsdom has none
      value: (_url: string, data: Blob) => { sent.push(data); return true; }, configurable: true,
    });

    // a fresh module copy = a fresh document load; React comes from the same copy as the components
    vi.resetModules();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const [{ createElement }, { act }, { renderToString }, { hydrateRoot }, { TrackVisit }, { FlowRoot }] = await Promise.all([
      import("react"), import("react"), import("react-dom/server"), import("react-dom/client"),
      import("./TrackVisit"), import("./flow/FlowRoot"),
    ]);
    const tree = createElement("div", null, createElement(TrackVisit), createElement(FlowRoot, { vocab: ACTIVE_VOCAB }));
    const host = document.createElement("div");
    host.innerHTML = renderToString(tree);
    document.body.append(host);
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => { root = hydrateRoot(host, tree); });
    unmount = () => { void act(() => root.unmount()); host.remove(); };

    const bodies = await Promise.all(sent.map(async (b) => JSON.parse(await b.text()) as { name: string; common: Record<string, unknown> }));
    return bodies.filter((b) => b.name === "site_visited");
  }

  it("navigate: the visit is the new game's — round + 1, no entry — and S-01 is on screen", async () => {
    const visits = await openWith("navigate");
    expect(visits).toHaveLength(1);
    expect(visits[0].common).toMatchObject({ round: 2, entry: null });
    expect(document.body.textContent).toContain("그냥 한 권 만나고 싶어요");
  });

  it("reload: the visit keeps the round and the entry of the game that resumes", async () => {
    const visits = await openWith("reload");
    expect(visits).toHaveLength(1);
    expect(visits[0].common).toMatchObject({ round: 1, entry: "leaf" });
    expect(document.body.textContent).not.toContain("그냥 한 권 만나고 싶어요");
  });
});
