import data from "@/data/news.json";

/**
 * PRD F-28 갈피 소식통: one week of news (Monday to Sunday) and what changed in it, one line each. The operator writes
 * `src/data/news.json` by hand and deploys it — nothing about the person, no server.
 */
export interface NewsWeek { start: string; end: string; items: string[] }

/** The Monday of the newest week this browser opened the sheet on (DESIGN C-33 new-news dot). */
export const NEWS_SEEN_KEY = "galpi.news.seenWeek";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

function checkWeek(raw: unknown): NewsWeek {
  const w = raw as Partial<NewsWeek> | null;
  if (!w || typeof w.start !== "string" || typeof w.end !== "string" || !Array.isArray(w.items)) {
    throw new Error(`news: a week needs start, end and items — ${JSON.stringify(raw)}`);
  }
  const { start, end, items } = w;
  if (!DATE.test(start) || !DATE.test(end)) throw new Error(`news: dates are YYYY-MM-DD — ${start} ~ ${end}`);
  if (utc(start).getUTCDay() !== 1) throw new Error(`news: a week starts on a Monday — ${start}`);
  if (utc(end).getTime() - utc(start).getTime() !== 6 * DAY_MS) throw new Error(`news: a week ends six days later — ${start} ~ ${end}`);
  if (items.length === 0 || items.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`news: every week needs at least one non-empty line — ${start}`);
  }
  if (new Set(items).size !== items.length) throw new Error(`news: each line once in a week — ${start}`);
  return { start, end, items: [...items] };
}

/** Checks the hand-written file and puts the newest week first. Throws on any mistake, so a bad file fails the tests. */
export function parseWeeks(raw: unknown): NewsWeek[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("news: the file is a non-empty list of weeks");
  const weeks = raw.map(checkWeek);
  if (new Set(weeks.map((w) => w.start)).size !== weeks.length) throw new Error("news: each week once");
  return [...weeks].sort((a, b) => b.start.localeCompare(a.start));
}

export const NEWS_WEEKS: readonly NewsWeek[] = parseWeeks(data);

export function latestWeek(): NewsWeek {
  return NEWS_WEEKS[0];
}

const monthDay = (date: string) => {
  const d = utc(date);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
};

/** "10월 19일 – 10월 25일" */
export function weekLabel(week: NewsWeek): string {
  return `${monthDay(week.start)} – ${monthDay(week.end)}`;
}

/**
 * The dot shows when this browser never opened a week this new. Storage blocked (private mode, some in-app browsers):
 * we cannot tell, so no dot — never a dot that cannot go away.
 */
export function hasUnseenNews(latestStart: string): boolean {
  try {
    const seen = window.localStorage.getItem(NEWS_SEEN_KEY);
    // nothing stored, or a value that is not a date (it would never compare as older) → the dot shows
    return seen === null || !DATE.test(seen) || seen < latestStart;
  } catch {
    return false;
  }
}

const listeners = new Set<() => void>();

export function markNewsSeen(latestStart: string): void {
  try {
    window.localStorage.setItem(NEWS_SEEN_KEY, latestStart);
  } catch {
    // the dot simply stays as it was on the next load
  }
  for (const listener of listeners) listener();
}

/** For useSyncExternalStore: this tab marking the news seen, or another tab doing it. */
export function subscribeNews(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
