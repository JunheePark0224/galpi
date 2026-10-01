"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { startAmplitude } from "@/lib/track/amplitude";

/**
 * Asks for Amplitude once (the module guards repeats; the SDK itself loads later, when the browser is idle).
 * Events sent before this effect runs (a `site_visited` from the page below it) wait in the queue with the time they
 * happened (taxonomy 2-7 a·b), so nothing depends on the order of effects.
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
