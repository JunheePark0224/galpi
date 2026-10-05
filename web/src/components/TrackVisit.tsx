"use client";
import { useEffect } from "react";
import { settleOpen } from "@/lib/flow/storage";
import { afterAmplitudeRead } from "@/lib/track/amplitude";
import { stripCampaignFromAddress } from "@/lib/track/campaign";
import { track } from "@/lib/track/client";
import { campaignAtLanding } from "@/lib/track/common";

export function TrackVisit() {
  useEffect(() => {
    settleOpen();                   // a fresh open moves the round on and clears the entry before this visit is sent
    // taxonomy v1.4: the session's first-touch utm tags ride on the visit; then they leave the address bar, once
    // Amplitude (which reads them from the URL itself) has seen them.
    track("site_visited", campaignAtLanding());
    afterAmplitudeRead(stripCampaignFromAddress);
  }, []);
  return null;
}
