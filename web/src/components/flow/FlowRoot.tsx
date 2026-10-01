"use client";
import { useSyncExternalStore } from "react";
import type { Vocab } from "@/lib/books/types";
import { Flow } from "./Flow";
import { Home } from "./Home";

const subscribe = () => () => {};
const noop = () => {};

/**
 * Server HTML (and the hydration pass) is S-01; the browser then resumes the saved flow without a mismatch.
 * vocab: the active 🎯 topics' part of vocab.json, worked out on the server (page.tsx) so books.json never ships.
 */
export function FlowRoot({ vocab }: { vocab: Vocab }) {
  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false);
  return inBrowser ? <Flow vocab={vocab} /> : <Home onStart={noop} />;
}
