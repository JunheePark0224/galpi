"use client";
import { useSyncExternalStore } from "react";
import type { LibraryCount } from "@/lib/books/library";
import type { Vocab } from "@/lib/books/types";
import { Flow } from "./Flow";
import { Home } from "./Home";

const subscribe = () => () => {};
const noop = () => {};

/**
 * Server HTML (and the hydration pass) is S-01; the browser then resumes the saved flow without a mismatch.
 * vocab: the active 🎯 topics' part of vocab.json, worked out on the server (page.tsx) so books.json never ships.
 * library: the F-23 count, also from the server (null until the first fill).
 */
export function FlowRoot({ vocab, library = null }: { vocab: Vocab; library?: LibraryCount | null }) {
  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false);
  return inBrowser ? <Flow vocab={vocab} library={library} /> : <Home onStart={noop} library={library} />;
}
