"use client";
import { useSyncExternalStore } from "react";
import { Flow } from "./Flow";
import { Home } from "./Home";

const subscribe = () => () => {};
const noop = () => {};

/** Server HTML (and the hydration pass) is S-01; the browser then resumes the saved flow without a mismatch. */
export function FlowRoot() {
  const inBrowser = useSyncExternalStore(subscribe, () => true, () => false);
  return inBrowser ? <Flow /> : <Home onStart={noop} />;
}
