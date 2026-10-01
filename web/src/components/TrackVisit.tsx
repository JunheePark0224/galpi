"use client";
import { useEffect } from "react";
import { settleOpen } from "@/lib/flow/storage";
import { track } from "@/lib/track/client";

export function TrackVisit() {
  useEffect(() => {
    settleOpen();                   // a fresh open moves the round on and clears the entry before this visit is sent
    track("site_visited", {});
  }, []);
  return null;
}
