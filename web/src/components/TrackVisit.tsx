"use client";
import { useEffect } from "react";
import { track } from "@/lib/track/client";

export function TrackVisit() {
  useEffect(() => { track("visit"); }, []);
  return null;
}
