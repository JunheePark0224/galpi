import type { FlowState } from "./state";

/**
 * What the phone's back key does on each screen (10-08, user-approved table — plans/2026-10-08-device-back.md):
 * leave = the browser's own back (home: out of the site); question = drop the last answer (E-33 device_back);
 * home = to S-01 (E-20 device_back); hold = stay — a reaction is never undone (Flow asks for a second press);
 * prevResult = the previous 궁금해요 book; toBack = the 뒤표지.
 */
export type DeviceBackMove = "leave" | "question" | "home" | "hold" | "prevResult" | "toBack";

export function deviceBackMove(s: FlowState): DeviceBackMove {
  switch (s.step) {
    case "home":
      return "leave";
    case "questions":
      return s.answers.length > 0 ? "question" : "home";
    case "book":
    case "first":
      return "question";
    case "bookmarks":
    case "back":
      return "hold";
    case "result":
      return s.result > 0 ? "prevResult" : "toBack";
    case "end":
      return "toBack";
  }
}
