import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addGuestSave, dropGuestSaves, failGuestSaves, GUEST_KEY, GUEST_MAX, GUEST_TRIES, guestSaves, removeGuestSave, subscribeGuest, useGuestSaves,
  type GuestSave,
} from "./guest";

const card = (isbn: string) => ({
  id: isbn, entry: "leaf" as const, title: `책 ${isbn.slice(-3)}`, author: "지어낸 저자", genre: "한국 소설", field: null,
  oneLiner: "지어낸 한 줄", oneLinerStyle: "question" as const,
});
const save = (isbn: string): GuestSave => ({
  isbn, art: { animal: "fox", bg: "night", sky: "moon", ground: "books", rare: false },
  reason: { label: "나온 이유", items: ["따뜻함"] }, metOn: "2026-10-05", card: card(isbn),
});
const ISBN = "9788998441012";
const isbnAt = (i: number) => `979000000${String(i).padStart(4, "0")}`;

describe("guest saves (로그인 전 내 책갈피, localStorage galpi.guestSaves)", () => {
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it("starts empty, keeps one bookmark per book, newest first, in { v: 1, items }", () => {
    expect(guestSaves()).toEqual([]);
    expect(addGuestSave(save(ISBN))).toBe("added");
    expect(addGuestSave(save(isbnAt(1)))).toBe("added");
    expect(addGuestSave(save(ISBN))).toBe("already");
    expect(guestSaves().map((s) => s.isbn)).toEqual([isbnAt(1), ISBN]);
    expect(JSON.parse(localStorage.getItem(GUEST_KEY) ?? "")).toEqual({ v: 1, items: [save(isbnAt(1)), save(ISBN)] });
  });

  it("gives the same list back until it changes (a stable snapshot for React)", () => {
    addGuestSave(save(ISBN));
    expect(guestSaves()).toBe(guestSaves());
    const before = guestSaves();
    addGuestSave(save(isbnAt(1)));
    expect(guestSaves()).not.toBe(before);
  });

  it("holds at most 100 — the 101st is not kept", () => {
    for (let i = 0; i < GUEST_MAX; i++) expect(addGuestSave(save(isbnAt(i)))).toBe("added");
    expect(addGuestSave(save(ISBN))).toBe("full");
    expect(addGuestSave(save(isbnAt(5)))).toBe("already");
    expect(guestSaves()).toHaveLength(GUEST_MAX);
  });

  it("removes one, and drops the ones that went to the account (empty list = the key is gone)", () => {
    addGuestSave(save(ISBN));
    addGuestSave(save(isbnAt(1)));
    addGuestSave(save(isbnAt(2)));
    expect(removeGuestSave(isbnAt(1))).toBe(true);
    expect(removeGuestSave(isbnAt(1))).toBe(false);
    dropGuestSaves([ISBN, isbnAt(9)]);
    expect(guestSaves().map((s) => s.isbn)).toEqual([isbnAt(2)]);
    dropGuestSaves([isbnAt(2)]);
    expect(localStorage.getItem(GUEST_KEY)).toBeNull();
    dropGuestSaves([]);
    expect(guestSaves()).toEqual([]);
  });

  it("tells listeners about its own changes and another tab's", () => {
    const seen = vi.fn();
    const stop = subscribeGuest(seen);
    addGuestSave(save(ISBN));
    removeGuestSave(ISBN);
    removeGuestSave(ISBN);                                             // nothing there: no change
    window.dispatchEvent(new StorageEvent("storage", { key: GUEST_KEY }));
    window.dispatchEvent(new StorageEvent("storage", { key: null }));      // another tab cleared the storage
    window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
    expect(seen).toHaveBeenCalledTimes(4);
    stop();
    addGuestSave(save(ISBN));
    expect(seen).toHaveBeenCalledTimes(4);
  });

  it("reads only what it would have written: broken, old-version or odd items are left out", () => {
    localStorage.setItem(GUEST_KEY, "{oops");
    expect(guestSaves()).toEqual([]);
    localStorage.setItem(GUEST_KEY, JSON.stringify({ v: 2, items: [save(ISBN)] }));
    expect(guestSaves()).toEqual([]);
    localStorage.setItem(GUEST_KEY, JSON.stringify({ v: 1, items: "no" }));
    expect(guestSaves()).toEqual([]);
    const odd = [
      null,
      { ...save(isbnAt(1)), isbn: 12 },
      { ...save(isbnAt(2)), art: { animal: "dragon" } },
      { ...save(isbnAt(3)), reason: { label: "<b>", items: [] } },
      { ...save(isbnAt(4)), metOn: 5 },
      { ...save(isbnAt(12)), metOn: "2026-13-40" },                                  // not a calendar date
      { ...save(isbnAt(13)), metOn: "2999-01-01" },                                  // after today
      { ...save(isbnAt(14)), tries: -1 },
      { ...save(isbnAt(15)), tries: 1.5 },
      { ...save(isbnAt(5)), card: { ...card(isbnAt(5)), id: ISBN } },               // a card of another book
      { ...save(isbnAt(6)), card: { ...card(isbnAt(6)), entry: "x" } },
      { ...save(isbnAt(7)), card: { ...card(isbnAt(7)), field: 3 } },
      { ...save(isbnAt(8)), card: { ...card(isbnAt(8)), oneLinerStyle: "x" } },
      { ...save(isbnAt(9)), card: null },
      { ...save(isbnAt(10)), card: { ...card(isbnAt(10)), title: 1 } },
      save(ISBN),
      save(ISBN),                                                                     // the same book twice: once
      { ...save(isbnAt(11)), card: { ...card(isbnAt(11)), entry: "target", field: "데이터 분석" } },
    ];
    localStorage.setItem(GUEST_KEY, JSON.stringify({ v: 1, items: odd }));
    expect(guestSaves().map((s) => s.isbn)).toEqual([ISBN, isbnAt(11)]);
  });

  it("says when the browser will not keep anything (private mode and the like)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(addGuestSave(save(ISBN))).toBe("blocked");
    expect(guestSaves()).toEqual([]);
    vi.restoreAllMocks();
    addGuestSave(save(ISBN));
    addGuestSave(save(isbnAt(1)));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(removeGuestSave(ISBN)).toBe(false);
    expect(guestSaves()).toHaveLength(2);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(guestSaves()).toEqual([]);
  });

  it("is empty in the server's HTML (nothing to read there), whatever this browser holds", () => {
    addGuestSave(save(ISBN));
    const Count = () => createElement("span", null, useGuestSaves().length);
    expect(renderToString(createElement(Count))).toBe("<span>0</span>");
  });

  it("counts failed moves per bookmark and lets one go after GUEST_TRIES visits", () => {
    addGuestSave(save(ISBN));
    addGuestSave(save(isbnAt(1)));
    expect(GUEST_TRIES).toBe(3);
    failGuestSaves([ISBN]);
    failGuestSaves([ISBN, isbnAt(9)]);
    expect(guestSaves().find((s) => s.isbn === ISBN)?.tries).toBe(2);
    expect(guestSaves().find((s) => s.isbn === isbnAt(1))?.tries).toBeUndefined();
    failGuestSaves([ISBN]);
    expect(guestSaves().map((s) => s.isbn)).toEqual([isbnAt(1)]);
    failGuestSaves([]);
    expect(guestSaves()).toHaveLength(1);
  });

  it("keeps the draw's signed ticket and the bookmark's place in it, read with the 도감's rules (v1.7 — for the 도감 after a login)", () => {
    const meeting = { seed: 1234, count: 5, iat: 1_790_000_000, sub: null, sig: "a".repeat(43), index: 2 };
    expect(addGuestSave({ ...save(ISBN), meeting })).toBe("added");
    expect(guestSaves()[0].meeting).toEqual(meeting);
    const stored = (m: unknown) => JSON.stringify({ v: 1, items: [{ ...save(ISBN), meeting: m }] });
    localStorage.setItem(GUEST_KEY, stored({ ...meeting, sub: undefined }));
    expect(guestSaves()[0].meeting).toEqual(meeting);                              // sub absent = a logged-out draw
    // a broken ticket is dropped, the bookmark stays (it can still move to the account, just not into the 도감)
    for (const bad of [{ ...meeting, index: 5 }, { ...meeting, sig: "short" }, { ...meeting, seed: -1 }, "x", null]) {
      localStorage.setItem(GUEST_KEY, stored(bad));
      expect(guestSaves().map((s) => [s.isbn, s.meeting]), JSON.stringify(bad)).toEqual([[ISBN, undefined]]);
    }
  });
});
