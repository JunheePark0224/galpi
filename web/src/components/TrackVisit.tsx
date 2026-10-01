"use client";
import { useEffect } from "react";
import { track } from "@/lib/track/client";

export function TrackVisit() {
  useEffect(() => { track("site_visited", {}); }, []);
  return null;
}
