import { describe, expect, it } from "vitest";
import type { ArtCombo } from "@/lib/art/combine";
import { memoryStore } from "./__fixtures__/memoryStore";
import { changedKinds, decorateBookmark, decoratedProps, forbiddenKinds, ownedSet, partAllowed, sameArt } from "./decorate";

const FIRST: ArtCombo = { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false };
const OWNED = ownedSet([{ kind: "animal", value: "otter" }, { kind: "sky", value: "goldmoon" }]);

describe("꾸미기 rule (screen and server)", () => {
  it("allows a collected part, the bookmark's own first part and the empty ground — nothing else", () => {
    expect(partAllowed("animal", "otter", FIRST, OWNED)).toBe(true);
    expect(partAllowed("animal", "fox", FIRST, OWNED)).toBe(true);
    expect(partAllowed("ground", "none", FIRST, OWNED)).toBe(true);
    expect(partAllowed("animal", "bluedragon", FIRST, OWNED)).toBe(false);
    expect(partAllowed("sky", "otter", FIRST, OWNED)).toBe(false);              // a value is owned per kind
    expect(forbiddenKinds({ ...FIRST, animal: "bluedragon", sky: "goldmoon", bg: "galaxy" }, FIRST, OWNED)).toEqual(["animal", "bg"]);
  });

  it("names the kinds that changed, in picture order", () => {
    expect(changedKinds(FIRST, { ...FIRST, ground: "none", animal: "otter" })).toEqual(["animal", "ground"]);
    expect(sameArt(FIRST, { ...FIRST, rare: true })).toBe(true);
    expect(sameArt(FIRST, { ...FIRST, bg: "peach" })).toBe(false);
  });

  it("decorates through the store: missing book, unknown first picture, forbidden part, saved", async () => {
    const store = memoryStore({ saves: [{ isbn: "9788998441012", art: FIRST, originalArt: FIRST, reason: { label: "이 책은", items: [] }, metOn: "2026-10-05", shelfId: "a", position: 0 }] });
    const owned = async () => [{ kind: "animal" as const, value: "otter" }];
    expect(await decorateBookmark(store, owned, "9788998441029", FIRST)).toEqual({ ok: false, error: "missing" });
    expect(await decorateBookmark(store, owned, "9788998441012", { ...FIRST, animal: "panda" })).toEqual({ ok: false, error: "forbidden" });
    expect(await decorateBookmark(store, owned, "9788998441012", { ...FIRST, animal: "otter" })).toEqual({ ok: true, art: { ...FIRST, animal: "otter", rare: true } });
    const old = memoryStore({ saves: [{ isbn: "9788998441012", art: FIRST, reason: { label: "이 책은", items: [] }, metOn: "2026-10-05", shelfId: "a", position: 0 }] });
    expect(await decorateBookmark(old, owned, "9788998441012", FIRST)).toEqual({ ok: false, error: "unavailable" });
  });
});

describe("E-38 bookmark_decorated payload", () => {
  it("names the changed parts with their new tiers, the new picture and whether it went back to the first", () => {
    const now = { ...FIRST, animal: "otter" as const, rare: true };
    expect(decoratedProps("9788998441012", FIRST, { ...now, ground: "none", sky: "goldmoon", rare: false }, FIRST)).toEqual({
      book_id: "9788998441012",
      parts_changed: ["animal", "sky", "ground"],
      tiers_changed: ["limited", "first_edition", "common"],
      art: { animal: "otter", bg: "night", sky: "goldmoon", ground: "none", rare: true },
      is_reset: false,
    });
    expect(decoratedProps("9788998441012", now, FIRST, FIRST)).toEqual({
      book_id: "9788998441012", parts_changed: ["animal"], tiers_changed: ["common"], art: FIRST, is_reset: true,
    });
  });
});
