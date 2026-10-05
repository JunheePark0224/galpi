import { afterEach, describe, expect, it, vi } from "vitest";
import type { FlowState } from "@/lib/flow/state";
import { SQL_PATH } from "@/lib/paths/__fixtures__/paths";

/**
 * The first visit event of a document must already carry the round and entry that document starts in. The real page is server
 * HTML (S-01) hydrated on the client: TrackVisit's effect runs in the hydration commit, before FlowRoot switches to Flow.
 */
describe("site_visited on a fresh open vs a reload (hydrated TrackVisit + FlowRoot)", () => {
  const midRound = { step: "bookmarks", answers: SQL_PATH, asked: SQL_PATH.length, seen: ["b1"] } as unknown as FlowState;
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
    sessionStorage.setItem("galpi.flow", JSON.stringify({ v: 6, state: { ...midRound, status: "idle", draw: null } }));
    sessionStorage.setItem("galpi.round", "1");
    sessionStorage.setItem("galpi.entry", "target");
    sessionStorage.setItem("galpi.mode", "normal");
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
    const tree = createElement("div", null, createElement(TrackVisit), createElement(FlowRoot, {}));
    const host = document.createElement("div");
    host.innerHTML = renderToString(tree);
    document.body.append(host);
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => { root = hydrateRoot(host, tree); });
    unmount = () => { void act(() => root.unmount()); host.remove(); };

    const bodies = await Promise.all(sent.map(async (b) => JSON.parse(await b.text()) as { name: string; common: Record<string, unknown> }));
    return bodies.filter((b) => b.name === "site_visited");
  }

  it("navigate: the visit is the new game's — round + 1, no entry, no mode — and S-01 is on screen", async () => {
    const visits = await openWith("navigate");
    expect(visits).toHaveLength(1);
    expect(visits[0].common).toMatchObject({ round: 2, entry: null, mode: null });
    expect(document.body.textContent).toContain("갈피 잡으러 가기");
  });

  it("reload: the visit keeps the round, the entry and the mode of the game that resumes", async () => {
    const visits = await openWith("reload");
    expect(visits).toHaveLength(1);
    expect(visits[0].common).toMatchObject({ round: 1, entry: "target", mode: "normal" });
    expect(document.body.textContent).not.toContain("갈피 잡으러 가기");
  });
});

describe("site_visited carries the first-touch utm tags, then they leave the address (taxonomy v1.4)", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "sendBeacon");
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("sends the cleaned tags as the visit's props and takes them off the address (Amplitude off: at once)", async () => {
    vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    window.history.replaceState({ keep: 1 }, "", "/?utm_source=LinkedIn&utm_medium=social&utm_campaign=launch_1007&utm_content=a&x=1#top");
    const sent: Blob[] = [];
    Object.defineProperty(navigator, "sendBeacon", {
      value: (_url: string, data: Blob) => { sent.push(data); return true; }, configurable: true,
    });
    vi.resetModules();
    const [{ render }, { TrackVisit }] = await Promise.all([import("@testing-library/react"), import("./TrackVisit")]);
    const view = render(<TrackVisit />);
    const bodies = await Promise.all(sent.map(async (b) => JSON.parse(await b.text()) as { name: string; props: Record<string, unknown> }));
    const visits = bodies.filter((b) => b.name === "site_visited");
    expect(visits).toHaveLength(1);
    expect(visits[0].props).toEqual({ utm_source: "linkedin", utm_medium: "social", utm_campaign: "launch_1007" });
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/?x=1#top");
    expect(window.history.state).toEqual({ keep: 1 });
    view.unmount();
  });

  it("sends three nulls for an untagged visit", async () => {
    vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const sent: Blob[] = [];
    Object.defineProperty(navigator, "sendBeacon", {
      value: (_url: string, data: Blob) => { sent.push(data); return true; }, configurable: true,
    });
    vi.resetModules();
    const [{ render }, { TrackVisit }] = await Promise.all([import("@testing-library/react"), import("./TrackVisit")]);
    const view = render(<TrackVisit />);
    const body = JSON.parse(await sent[0].text()) as { props: Record<string, unknown> };
    expect(body.props).toEqual({ utm_source: null, utm_medium: null, utm_campaign: null });
    view.unmount();
  });
});
