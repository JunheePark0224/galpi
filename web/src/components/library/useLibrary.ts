"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { addSavedCount, setSavedCount, signedOut } from "@/lib/account/store";
import type { ArtCombo } from "@/lib/art/combine";
import { libraryRequest } from "@/lib/library/client";
import { decoratedProps } from "@/lib/library/decorate";
import { onGuestMerged } from "@/lib/library/merge";
import type { LibraryView } from "@/lib/library/types";
import { artLocally, moveLocally, removeLocally } from "@/lib/library/view";
import { setAmplitudeUser } from "@/lib/track/amplitude";
import { track } from "@/lib/track/client";

export type LibraryStatus = "loading" | "ready" | "error" | "login";
/** E-30 method: drag = [책갈피 옮기기] 모드에서 끌어서 놓기 (10-04), menu = the sheet's [다른 막대로 옮기기]. */
export type MoveMethod = "drag" | "menu";

/**
 * S-09's rods from /api/library, and the changes (each sent to the API, then the rods are read again — the server is the
 * one place that orders them). Events go only after a change succeeded: E-17 on the first load, E-16, E-29 (number of
 * rods — the name never), E-30, E-35 ([모두 제거], v1.2), E-38 (꾸미기, v1.6), E-40 ([막대 지우기], v1.8). Renaming a
 * rod has no event (taxonomy v0.8).
 */
export function useLibrary() {
  const [status, setStatus] = useState<LibraryStatus>("loading");
  const [view, setView] = useState<LibraryView | null>(null);
  const viewed = useRef(false);
  const current = useRef<LibraryView | null>(null);
  useEffect(() => { current.current = view; }, [view]);

  // Reads can overlap (the first read and the one after this browser's bookmarks moved, v1.7): the one started last wins
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++latest.current;
    const answer = await libraryRequest("GET", "/api/library");
    if (seq !== latest.current) return;
    if (answer.status === 401) {          // the session ran out: the header and Amplitude follow
      setStatus("login");
      signedOut();
      setAmplitudeUser(null);
      return;
    }
    if (!answer.ok || !answer.body) {
      setStatus("error");
      return;
    }
    const next = answer.body as LibraryView;
    setView(next);
    setStatus("ready");
    setSavedCount(next.count);
    if (!viewed.current) {
      viewed.current = true;
      track("library_viewed", { saved_count: next.count });
    }
  }, []);

  useEffect(() => {
    let live = true;
    void (async () => { if (live) await reload(); })();
    return () => { live = false; };
  }, [reload]);

  // v1.7: bookmarks kept in this browser before the login may arrive after the first read (LoginReturn moves them)
  useEffect(() => onGuestMerged(() => { void reload(); }), [reload]);

  const change = useCallback(async (method: "POST" | "PATCH" | "DELETE", path: string, body: unknown, after?: (answer: unknown) => void) => {
    const answer = await libraryRequest(method, path, body);
    if (!answer.ok) return false;
    after?.(answer.body);
    await reload();
    return true;
  }, [reload]);

  /**
   * Moving and removing show at once (user, 10-02 — no wait for two server trips): the rods change on screen first, then
   * the server is told; if it says no, the rods go back as they were and the caller says so. The rods are read again
   * quietly afterwards so the server's order wins.
   */
  const atOnce = useCallback(async (
    next: (v: LibraryView) => LibraryView, method: "PATCH" | "DELETE", body: unknown, after: () => void, path = "/api/library/saves",
  ) => {
    const before = current.current;
    if (before) {
      const drawn = next(before);
      current.current = drawn;
      setView(drawn);
    }
    const answer = await libraryRequest(method, path, body);
    if (!answer.ok) {
      if (before) {
        current.current = before;
        setView(before);
      }
      void reload();                      // and then the server's order, in case it changed meanwhile
      return false;
    }
    after();
    void reload();
    return true;
  }, [reload]);

  const shelfCount = view?.shelves.length ?? 0;
  return {
    status,
    view,
    reload,
    /** To `index` of the rod's other bookmarks (a drag — the same rod too), or without it to the rod's front (the menu). */
    move: (isbn: string, shelfId: string, method: MoveMethod, index?: number) => {
      const sameShelf = !!view?.shelves.find((s) => s.id === shelfId)?.bookmarks.some((b) => b.isbn === isbn);
      return atOnce((v) => moveLocally(v, isbn, shelfId, index), "PATCH", index === undefined ? { isbn, shelfId } : { isbn, shelfId, index },
        () => track("bookmark_moved", { book_id: isbn, method, is_same_shelf: sameShelf }));
    },
    /**
     * 꾸미기 (v1.6): the new picture on the rod and in the sheet at once, then the server (which checks every part against the
     * 도감); refused = the picture goes back. E-38 after the server saved it. [처음 그림으로] sends the first picture.
     */
    decorate: (isbn: string, art: ArtCombo) => {
      const bookmark = view?.shelves.flatMap((s) => s.bookmarks).find((b) => b.isbn === isbn);
      if (!bookmark?.originalArt) return Promise.resolve(false);
      const { art: before, originalArt } = bookmark;
      return atOnce((v) => artLocally(v, isbn, art), "PATCH", { isbn, art },
        () => track("bookmark_decorated", decoratedProps(isbn, before, art, originalArt)), "/api/library/saves/art");
    },
    remove: (isbn: string) =>
      atOnce((v) => removeLocally(v, isbn), "DELETE", { isbn }, () => {
        track("book_unsaved", { book_id: isbn });
        addSavedCount(-1);
      }),
    /**
     * [모두 제거] (10-04): not at once like a single remove — a bulk loss shows only after the server took it. Then E-35
     * (one event, no E-16 per book), the header count 0, and the rods read again (they stay, empty).
     */
    clearAll: async () => {
      const answer = await libraryRequest("DELETE", "/api/library/saves/all", { all: true });
      if (!answer.ok) return false;
      const removed = (answer.body as { removed?: unknown } | null)?.removed;
      track("library_cleared", { removed_count: typeof removed === "number" ? removed : (current.current?.count ?? 0) });
      setSavedCount(0);
      await reload();
      return true;
    },
    addShelf: (name: string) =>
      change("POST", "/api/library/shelves", { name }, () => track("shelf_created", { shelf_count: Math.max(shelfCount, 1) + 1 })),
    renameShelf: (id: string, name: string) => change("PATCH", "/api/library/shelves", { id, name }),
    /**
     * [막대 지우기] (10-07): an empty rod (`withBookmarks` false), or the rod and its bookmarks after the confirm sheet —
     * not at once (a bulk loss shows only after the server took it, like [모두 제거]). Then E-40 with the number of bookmarks
     * that went (no E-16 per book) and the rods read again (the header count follows).
     */
    removeShelf: (id: string, withBookmarks = false) =>
      change("DELETE", "/api/library/shelves", withBookmarks ? { id, withBookmarks: true } : { id }, (body) => {
        const removed = (body as { removed?: unknown } | null)?.removed;
        const shown = current.current?.shelves.find((s) => s.id === id)?.bookmarks.length ?? 0;
        track("shelf_removed", { removed_count: typeof removed === "number" ? removed : (withBookmarks ? shown : 0) });
      }),
  };
}
