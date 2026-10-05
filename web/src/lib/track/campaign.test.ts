import { afterEach, describe, expect, it } from "vitest";
import { campaignFrom, cleanUtm, NO_CAMPAIGN, parseCampaign, stripCampaignFromAddress, withoutCampaign } from "./campaign";

describe("cleanUtm (taxonomy v1.4: [a-z0-9_-], 1–40, lowercased, else null)", () => {
  it.each([
    ["linkedin", "linkedin"],
    ["Threads", "threads"],
    ["launch_1007", "launch_1007"],
    ["paid-social", "paid-social"],
    ["x".repeat(40), "x".repeat(40)],
  ])("keeps %s", (raw, expected) => expect(cleanUtm(raw)).toBe(expected));

  it.each([
    ["too long", "x".repeat(41)],
    ["empty", ""],
    ["a space", "link edin"],
    ["Korean", "인스타"],
    ["an e-mail", "me@example.com"],
    ["a dot", "l.instagram.com"],
    ["markup", "<script>"],
  ])("turns %s into null", (_, raw) => expect(cleanUtm(raw)).toBeNull());

  it("is null for anything that is not a string", () => {
    expect(cleanUtm(null)).toBeNull();
    expect(cleanUtm(7)).toBeNull();
    expect(cleanUtm(undefined)).toBeNull();
  });
});

describe("campaignFrom", () => {
  it("reads the three tags of a launch link", () => {
    expect(campaignFrom("?utm_source=threads&utm_medium=social&utm_campaign=launch_1007")).toEqual(
      { utm_source: "threads", utm_medium: "social", utm_campaign: "launch_1007" });
  });
  it("accepts any values, cleaning each on its own", () => {
    expect(campaignFrom("?utm_source=Newsletter&utm_medium=e%20mail&ref=x")).toEqual(
      { utm_source: "newsletter", utm_medium: null, utm_campaign: null });
  });
  it("has nothing for an address without tags", () => {
    expect(campaignFrom("")).toEqual(NO_CAMPAIGN);
    expect(campaignFrom("?login=kakao")).toEqual(NO_CAMPAIGN);
  });
});

describe("parseCampaign (stored in sessionStorage — the visitor's, so read back with care)", () => {
  it("round-trips a stored campaign", () => {
    const c = { utm_source: "instagram", utm_medium: "social", utm_campaign: "launch_1007" };
    expect(parseCampaign(JSON.stringify(c))).toEqual(c);
  });
  it.each(["not json", "null", "1", "{\"utm_source\":\"bad value\",\"utm_medium\":3}"])("cleans %s", (raw) => {
    const parsed = parseCampaign(raw);
    expect(parsed.utm_medium).toBeNull();
    expect(parsed.utm_source).toBeNull();
  });
});

describe("withoutCampaign", () => {
  it("takes off every utm_* parameter, keeping the path, other parameters and the hash", () => {
    expect(withoutCampaign("/", "?utm_source=threads&login=kakao&utm_medium=social&UTM_Campaign=x&utm_content=a", "#top"))
      .toBe("/?login=kakao#top");
    expect(withoutCampaign("/", "?utm_source=threads&utm_medium=social&utm_campaign=launch_1007", "")).toBe("/");
  });
  it("is null when there is nothing to take off", () => {
    expect(withoutCampaign("/", "", "")).toBeNull();
    expect(withoutCampaign("/", "?login=kakao", "")).toBeNull();
  });
});

describe("stripCampaignFromAddress", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("replaces the address in place (no new history entry) and keeps the history state", () => {
    window.history.replaceState({ router: 1 }, "", "/?utm_source=linkedin&utm_medium=social&utm_campaign=launch_1007&x=1");
    const before = window.history.length;
    stripCampaignFromAddress();
    expect(window.location.pathname + window.location.search).toBe("/?x=1");
    expect(window.history.length).toBe(before);
    expect(window.history.state).toEqual({ router: 1 });
  });
  it("leaves an untagged address alone", () => {
    window.history.replaceState(null, "", "/privacy?y=2");
    stripCampaignFromAddress();
    expect(window.location.pathname + window.location.search).toBe("/privacy?y=2");
  });
});
