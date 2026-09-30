"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { startAmplitude } from "@/lib/track/amplitude";

/**
 * Starts Amplitude once (the module guards repeats). Placed before the page in the root layout so its effect runs
 * first: the `visit` event fired by a page below it is then already accepted (Amplitude queues until init finishes).
 * /privacy only reads the anonymous id and records nothing, so a visit that begins there does not start it;
 * moving on to another page does.
 */
export function AmplitudeInit() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== "/privacy") startAmplitude();
  }, [pathname]);
  return null;
}
