"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { addSavedCount, setSavedCount, signedOut } from "@/lib/account/store";
import { libraryRequest } from "@/lib/library/client";
import type { LibraryView } from "@/lib/library/types";
import { moveLocally, removeLocally } from "@/lib/library/view";
import { setAmplitudeUser } from "@/lib/track/amplitude";
import { track } from "@/lib/track/client";

export type LibraryStatus = "loading" | "ready" | "error" | "login";
export type MoveMethod = "hold" | "menu";

/**
 * S-09's rods from /api/library, and the changes (each sent to the API, then the rods are read again — the server is the
 * one place that orders them). Events go only after a change succeeded: E-17 on the first load, E-16, E-29 (number of
 * rods — the name never), E-30. Renaming and removing a rod have no event (taxonomy v0.8).
 */
export function useLibrary() {
  const [status, setStatus] = useState<LibraryStatus>("loading");
  const [view, setView] = useState<LibraryView | null>(null);
  const viewed = useRef(false);
  const current = useRef<LibraryView | null>(null);
  useEffect(() => { current.current = view; }, [view]);

  const reload = useCallback(async () => {
    const answer = await libraryRequest("GET", "/api/library");
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
  const atOnce = useCallback(async (next: (v: LibraryView) => LibraryView, method: "PATCH" | "DELETE", body: unknown, after: () => void) => {
    const before = current.current;
    if (before) {
      const drawn = next(before);
      current.current = drawn;
      setView(drawn);
    }
    const answer = await libraryRequest(method, "/api/library/saves", body);
    if (!answer.ok) {
      if (before) {
        current.current = before;
        setView(before);
      }
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
    move: (isbn: string, shelfId: string, method: MoveMethod) =>
      atOnce((v) => moveLocally(v, isbn, shelfId), "PATCH", { isbn, shelfId }, () => track("bookmark_moved", { book_id: isbn, method })),
    remove: (isbn: string) =>
      atOnce((v) => removeLocally(v, isbn), "DELETE", { isbn }, () => {
        track("book_unsaved", { book_id: isbn });
        addSavedCount(-1);
      }),
    addShelf: (name: string) =>
      change("POST", "/api/library/shelves", { name }, () => track("shelf_created", { shelf_count: Math.max(shelfCount, 1) + 1 })),
    renameShelf: (id: string, name: string) => change("PATCH", "/api/library/shelves", { id, name }),
    removeShelf: (id: string) => change("DELETE", "/api/library/shelves", { id }),
  };
}
