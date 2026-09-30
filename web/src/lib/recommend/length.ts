import type { Tag } from "./types";

/** Thin (<=250 pages) = 1, thick (>=400) = -1, otherwise 0. From YES24 page count, no human judgement. */
export function lengthTag(pages: number): Tag {
  if (pages <= 250) return 1;
  if (pages >= 400) return -1;
  return 0;
}
