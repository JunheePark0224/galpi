"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { startAmplitude } from "@/lib/track/amplitude";

/**
 * Asks for Amplitude once (the module guards repeats; the SDK itself loads later, when the browser is idle).
 * Placed before the page in the root layout so its effect runs first: a `visit` fired by a page below it is then
 * kept in the waiting queue instead of being dropped as "not started".
 * A visit that begins on /privacy does not start it (that page only reads the anonymous id and creates none);
 * moving on to another page does.
 */
export function AmplitudeInit() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== "/privacy") startAmplitude();
  }, [pathname]);
  return null;
}
