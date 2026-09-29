import { SCREEN_VERSION, type CommonProps } from "./schema";

const ANON = "galpi.anon";
const SEEN = "galpi.seen";
const SESSION = "galpi.session";

let entry: CommonProps["entry"] = null;
let round = 1;
let userId: string | null = null;

// In-memory fallbacks for stable IDs when storage is unavailable
let fallbackAnonId: string | null = null;
let fallbackSessionId: string | null = null;

function store(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;                                  // private mode or blocked storage
  }
}

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // RFC4122-v4 shaped string using Math.random when crypto.randomUUID unavailable
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrCreate(s: Storage | null, key: string, fallback: { get: () => string | null; set: (value: string) => void }): { value: string; created: boolean } {
  // Try storage first
  if (s) {
    try {
      const existing = s.getItem(key);
      if (existing) return { value: existing, created: false };
    } catch {
      // Storage read threw, check fallback for stability
      const fallbackValue = fallback.get();
      if (fallbackValue) return { value: fallbackValue, created: false };
    }
  }

  // Storage not available or is empty, create new ID
  const newId = generateId();
  let storageFailed = false;

  if (s) {
    try {
      s.setItem(key, newId);
    } catch {
      // Storage write threw, mark as failed
      storageFailed = true;
    }
  } else {
    // No storage available at all
    storageFailed = true;
  }

  // Update fallback only if storage is unavailable (for stability across re-renders when storage fails)
  if (storageFailed) {
    fallback.set(newId);
  }

  return { value: newId, created: true };
}

export function detectDevice(ua: string): { device: "phone" | "desktop"; in_app_browser: boolean } {
  const phone = /Mobi|Android|iPhone|iPod/i.test(ua);
  const inApp = /KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(inapp|Line\//i.test(ua);
  return { device: phone ? "phone" : "desktop", in_app_browser: inApp };
}

export function setEntry(next: CommonProps["entry"]): void { entry = next; }
export function nextRound(): void { round += 1; }
export function setUserId(id: string | null): void { userId = id; }

// For testing: reset in-memory fallbacks
export function _resetFallbacks(): void {
  fallbackAnonId = null;
  fallbackSessionId = null;
}

export function commonProps(): CommonProps {
  const local = store("local");
  const session = store("session");

  const anon = getOrCreate(local, ANON, {
    get: () => fallbackAnonId,
    set: (value) => { fallbackAnonId = value; },
  });
  const sessionId = getOrCreate(session, SESSION, {
    get: () => fallbackSessionId,
    set: (value) => { fallbackSessionId = value; },
  });

  let seenBefore = false;
  if (local) {
    try {
      seenBefore = local.getItem(SEEN) === "1";
    } catch {
      // Storage read threw
    }
  }
  const returning = seenBefore && sessionId.created;

  if (local) {
    try {
      local.setItem(SEEN, "1");
    } catch {
      // Storage write threw
    }
  }

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
