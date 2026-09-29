import { SCREEN_VERSION, type CommonProps } from "./schema";

const ANON = "galpi.anon";
const SEEN = "galpi.seen";
const SESSION = "galpi.session";

let entry: CommonProps["entry"] = null;
let round = 1;
let userId: string | null = null;

function store(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;                                  // private mode or blocked storage
  }
}

function getOrCreate(s: Storage | null, key: string): { value: string; created: boolean } {
  const existing = s?.getItem(key);
  if (existing) return { value: existing, created: false };
  const value = crypto.randomUUID();
  s?.setItem(key, value);
  return { value, created: true };
}

export function detectDevice(ua: string): { device: "phone" | "desktop"; in_app_browser: boolean } {
  const phone = /Mobi|Android|iPhone|iPod/i.test(ua);
  const inApp = /KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(inapp|Line\//i.test(ua);
  return { device: phone ? "phone" : "desktop", in_app_browser: inApp };
}

export function setEntry(next: CommonProps["entry"]): void { entry = next; }
export function nextRound(): void { round += 1; }
export function setUserId(id: string | null): void { userId = id; }

export function commonProps(): CommonProps {
  const local = store("local");
  const session = store("session");
  const anon = getOrCreate(local, ANON);
  const sessionId = getOrCreate(session, SESSION);
  const returning = local?.getItem(SEEN) === "1" && sessionId.created;
  local?.setItem(SEEN, "1");
  return {
    anon_id: anon.value,
    user_id: userId,
    session_id: sessionId.value,
    round,
    entry,
    screen_version: SCREEN_VERSION,
    referrer: typeof document === "undefined" ? "" : document.referrer,
    returning,
    ...detectDevice(typeof navigator === "undefined" ? "" : navigator.userAgent),
  };
}
