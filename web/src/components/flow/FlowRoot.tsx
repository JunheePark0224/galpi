"use client";
import { useSyncExternalStore } from "react";
import type { LibraryCount } from "@/lib/books/library";
import { Flow } from "./Flow";
import { Home } from "./Home";

const subscribe = () => () => {};
const noop = () => {};

/**
 * Server HTML (and the hydration pass) is S-01; the browser then resumes the saved flow without a mismatch.
 * library: the F-23 count, from the server (null until the first fill).
 */
export function FlowRoot({ library = null }: { library?: LibraryCount | null }) {
  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false);
  return inBrowser ? <Flow library={library} /> : <Home onStart={noop} library={library} />;
}
