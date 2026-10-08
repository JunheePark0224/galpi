"use client";
import { useEffect, useEffectEvent } from "react";
import { holdBack } from "./deviceBack";

/**
 * An open window (a sheet, the share sheet) closes with the phone's back key instead of the page going back (10-08):
 * it holds one history entry while it is open, and gives it back when it closes some other way.
 */
export function useBackToClose(onClose: () => void): void {
  const close = useEffectEvent(onClose);
  useEffect(() => {
    const hold = holdBack(() => close());
    return () => hold.release();
  }, []);
}
