import { AXES, type AxisKey, type Tag, type Way } from "../recommend/types";
import { FIELD_OF_TOPIC, LEAF_GENRES, TOPICS, WAYS, type Topic } from "./taxonomy";
import type { CatalogBook, OneLinerStyle, Vocab } from "./types";

type Row = Record<string, unknown>;

const STYLE: Record<string, OneLinerStyle> = { summary: "summary", question: "question", 요약형: "summary", 질문형: "question" };
const bad = (isbn: string, why: string) => new Error(`${isbn || "(no isbn)"}: ${why}`);

function base(raw: Row, titles: ReadonlyMap<string, string>) {
  const isbn = typeof raw.isbn === "string" ? raw.isbn : String(raw.isbn ?? "");
  if (!/^\d{13}$/.test(isbn)) throw bad(isbn, "isbn must be 13 digits");
  const title = titles.get(isbn);
  if (!title) throw bad(isbn, "no title in d1_selected.csv");
  const pages = Number(raw.pages);
  if (!Number.isInteger(pages) || pages <= 0) throw bad(isbn, "pages must be a positive integer");
  const oneLiner = typeof raw.one_liner === "string" ? raw.one_liner.trim() : "";
  if (!oneLiner) throw bad(isbn, "one_liner is empty");
  const style = STYLE[String(raw.one_liner_style)];
  if (!style) throw bad(isbn, `unknown one_liner_style ${String(raw.one_liner_style)}`);
  return { isbn, title, pages, one_liner: oneLiner, one_liner_style: style };
}

/** One row of books_v1(_draft).json → CatalogBook. Genre / field / topic are derived from entry + slot. */
export function normalizeBook(raw: Row, titles: ReadonlyMap<string, string>): CatalogBook {
  const b = base(raw, titles);
  const slot = String(raw.slot ?? "");
  if (raw.entry === "leaf") {
    if (!(LEAF_GENRES as readonly string[]).includes(slot)) throw bad(b.isbn, `unknown leaf genre ${slot}`);
    const axes = raw.axes;
    if (typeof axes !== "object" || axes === null) throw bad(b.isbn, "leaf book needs axes");
    const tags = {} as Record<AxisKey, Tag>;
    for (const axis of AXES) {
      const v = (axes as Row)[axis];
      if (v !== -1 && v !== 0 && v !== 1) throw bad(b.isbn, `axis ${axis} must be -1, 0 or 1`);
      tags[axis] = v;
    }
    return { ...b, entry: "leaf", genre: slot, field: null, topic: null, way: null, axes: tags, keywords: [] };
  }
  if (raw.entry === "target") {
    if (!(TOPICS as readonly string[]).includes(slot)) throw bad(b.isbn, `unknown topic ${slot}`);
    const topic = slot as Topic;
    if (!WAYS.includes(raw.way as Way)) throw bad(b.isbn, `way must be one of ${WAYS.join(", ")}`);
    const keywords = Array.isArray(raw.keywords) ? raw.keywords.filter((k): k is string => typeof k === "string") : [];
    return { ...b, entry: "target", genre: topic, field: FIELD_OF_TOPIC[topic], topic, way: raw.way as Way, axes: null, keywords };
  }
  throw bad(b.isbn, `unknown entry ${String(raw.entry)}`);
}

export function normalizeCatalog(rows: unknown, titles: ReadonlyMap<string, string>): CatalogBook[] {
  const list: Row[] = Array.isArray(rows)
    ? (rows as Row[])
    : typeof rows === "object" && rows !== null
      ? Object.entries(rows as Record<string, Row>).map(([isbn, r]) => ({ isbn, ...r }))
      : [];
  if (!list.length) throw new Error("no books in source");
  const books = list.map((r) => normalizeBook(r, titles));
  const seen = new Set<string>();
  for (const book of books) {
    if (seen.has(book.isbn)) throw bad(book.isbn, "duplicate isbn");
    seen.add(book.isbn);
  }
  return books;
}

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ""));
}

export function titlesFromCsv(text: string): Map<string, string> {
  const [head = [], ...rows] = parseCsv(text);
  const iIsbn = head.indexOf("isbn");
  const iTitle = head.indexOf("title");
  if (iIsbn < 0 || iTitle < 0) throw new Error("d1_selected.csv needs isbn and title columns");
  return new Map(rows.map((r) => [r[iIsbn], r[iTitle]]));
}

type RawTopic = { kept?: Record<string, { pattern?: unknown }>; folded?: Record<string, unknown>; too_common?: Record<string, unknown> };

/** keyword_vocab.json (v1.1) → the closed keyword list (kept) + topic words (folded / too-common names). */
export function normalizeVocab(raw: unknown): Vocab {
  if (typeof raw !== "object" || raw === null) throw new Error("vocab must be an object");
  const src = raw as Record<string, RawTopic | undefined>;
  const out: Vocab = {};
  for (const topic of TOPICS) {
    const t = src[topic];
    if (!t) throw new Error(`vocab has no topic ${topic}`);
    const keywords: Record<string, string> = {};
    for (const [name, k] of Object.entries(t.kept ?? {})) {
      if (typeof k.pattern !== "string") throw new Error(`${topic}/${name}: pattern must be a string`);
      try {
        new RegExp(k.pattern, "i");
      } catch {
        throw new Error(`${topic}/${name}: pattern does not compile`);
      }
      keywords[name] = k.pattern;
    }
    out[topic] = { keywords, terms: [...Object.keys(t.folded ?? {}), ...Object.keys(t.too_common ?? {})] };
  }
  return out;
}
