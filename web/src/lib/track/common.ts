import { SCREEN_VERSION, type CommonProps } from "./schema";

const ANON = "galpi.anon";
const SEEN = "galpi.seen";
const SESSION = "galpi.session";
const RETURNING = "galpi.returning";

let entry: CommonProps["entry"] = null;
let round = 1;
let userId: string | null = null;

// In-memory storage for stable IDs when storage is unavailable
const memory: Record<string, string> = {};

function store(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
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

function read(s: Storage | null, key: string): string | null {
  if (!s) return null;
  try {
    return s.getItem(key);
  } catch {
    return null;
  }
}

function write(s: Storage | null, key: string, value: string): void {
  if (!s) return;
  try {
    s.setItem(key, value);
  } catch {
    // blocked storage: memory keeps the value
  }
}

function getOrCreate(s: Storage | null, key: string): { value: string; created: boolean } {
  const existing = read(s, key) ?? memory[key];
  if (existing) return { value: existing, created: false };
  const value = generateId();
  memory[key] = value;
  write(s, key, value);
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

  // Decided once when the session is created, then reused for every event of that session.
  if (sessionId.created) {
    const seenBefore = (read(local, SEEN) ?? memory[SEEN]) === "1";
    const flag = seenBefore ? "1" : "0";
    memory[RETURNING] = flag;
    write(session, RETURNING, flag);
  }
  const returning = (read(session, RETURNING) ?? memory[RETURNING]) === "1";

  memory[SEEN] = "1";
  write(local, SEEN, "1");

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
